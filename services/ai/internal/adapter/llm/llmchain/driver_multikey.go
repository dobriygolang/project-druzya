// driver_multikey.go — round-robin wrapper над несколькими Driver-instance'ами
// одного провайдера с РАЗНЫМИ API-ключами. Полезно когда у тебя несколько
// аккаунтов с free-tier у одного провайдера (Groq/OpenRouter/Google/...) —
// квота складывается, и multi-key wrapper балансирует нагрузку между
// ключами + автоматически временно исключает rate-limited / unauthorized
// ключ из ротации, проверяет его раз в `cooldown` (default 1 час).
//
// Как использовать в monolith wirer:
//
//	keys := strings.Split(env("GROQ_API_KEY"), ",")
//	if len(keys) == 1 {
//	    drivers[ProviderGroq] = NewGroqDriver(keys[0])
//	} else {
//	    subs := make([]Driver, 0, len(keys))
//	    for _, k := range keys {
//	        if k = strings.TrimSpace(k); k != "" {
//	            subs = append(subs, NewGroqDriver(k))
//	        }
//	    }
//	    drivers[ProviderGroq] = NewMultiKeyDriver(ProviderGroq, subs, log)
//	}
//
// Поведение при ошибках:
//   - ErrRateLimited / ErrUnauthorized → ключ исключается на cooldown (1h);
//     запрос повторяется на следующем доступном ключе.
//   - Прочие ошибки (ErrProviderDown / ErrTimeout / ErrBadRequest) →
//     возвращаются caller'у НЕ trying next key. Chain.Chat сам решит,
//     fall-through на следующий provider или нет.
//   - Если все ключи в cooldown — возвращаем ErrAllProvidersUnavailable
//     (chain дальше — fall-through на следующий provider).
package llmchain

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

// MultiKeyAuthCooldown — после unauthorized/payment-required ключ исключается
// из rotation на это время.
const MultiKeyAuthCooldown = time.Hour

// MultiKeyRateLimitCooldown — 429 на free-tier (Google/Groq) обычно минутная,
// не часовая. 1h cooldown на 429 ломал probe: оба ключа → "all unavailable".
const MultiKeyRateLimitCooldown = 60 * time.Second

type multiKeySub struct {
	driver       Driver
	cooldownTill atomic.Int64 // unix-nano; 0 = доступен
}

func (s *multiKeySub) available(now time.Time) bool {
	till := s.cooldownTill.Load()
	if till == 0 {
		return true
	}
	if now.UnixNano() >= till {
		s.cooldownTill.Store(0)
		return true
	}
	return false
}

func (s *multiKeySub) markCooldown(until time.Time) {
	s.cooldownTill.Store(until.UnixNano())
}

// MultiKeyDriver — round-robin поверх N драйверов одного провайдера.
type MultiKeyDriver struct {
	provider Provider
	subs     []*multiKeySub
	cursor   atomic.Uint32 // round-robin counter; AtomicAdd → mod len
	log      *slog.Logger
	mu       sync.RWMutex // защищает только Capabilities() который readonly
	caps     Capabilities
}

// NewMultiKeyDriver wraps `subs` (≥1) под одним provider id. Если subs
// пустой — паника, потому что вызывающий код в monolith wirer имеет
// прямой контроль и должен skip'ать registration при 0 ключах.
func NewMultiKeyDriver(provider Provider, subs []Driver, log *slog.Logger) Driver {
	if len(subs) == 0 {
		panic("llmchain.NewMultiKeyDriver: empty subs")
	}
	if len(subs) == 1 {
		// Не оборачиваем 1-элементный массив — overhead atomic counter'ов
		// не нужен, плюс caller получает прямую цепочку для type-assertion'ов.
		return subs[0]
	}
	wrapped := make([]*multiKeySub, len(subs))
	for i, d := range subs {
		wrapped[i] = &multiKeySub{driver: d}
	}
	return &MultiKeyDriver{
		provider: provider,
		subs:     wrapped,
		log:      log,
		caps:     subs[0].Capabilities(), // все sub-драйверы одного провайдера → одинаковые caps
	}
}

func (m *MultiKeyDriver) Provider() Provider { return m.provider }

func (m *MultiKeyDriver) Capabilities() Capabilities {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.caps
}

// nextAvailable возвращает первый доступный sub по round-robin'у.
// nil если все в cooldown.
func (m *MultiKeyDriver) nextAvailable(now time.Time) *multiKeySub {
	n := uint32(len(m.subs))
	start := m.cursor.Add(1) - 1
	for i := uint32(0); i < n; i++ {
		idx := (start + i) % n
		s := m.subs[idx]
		if s.available(now) {
			return s
		}
	}
	return nil
}

func (m *MultiKeyDriver) cooldownFor(err error) time.Duration {
	if errors.Is(err, ErrRateLimited) {
		var hse *httpStatusError
		if errors.As(err, &hse) {
			if ra := parseRetryAfter(hse.Headers().Get("Retry-After"), time.Now()); ra > 0 {
				return ra
			}
		}
		return MultiKeyRateLimitCooldown
	}
	return MultiKeyAuthCooldown
}

func (m *MultiKeyDriver) handleErr(s *multiKeySub, err error) {
	if errors.Is(err, ErrRateLimited) || errors.Is(err, ErrUnauthorized) {
		cd := m.cooldownFor(err)
		s.markCooldown(time.Now().Add(cd))
		if m.log != nil {
			m.log.Warn("llmchain.MultiKeyDriver: key cooled down",
				slog.String("provider", string(m.provider)),
				slog.Duration("cooldown", cd),
				slog.String("err", err.Error()))
		}
	}
}

// Chat — пробуем доступные ключи поочерёдно при rate-limit/unauthorized;
// прочие ошибки возвращаем caller'у сразу.
func (m *MultiKeyDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	now := time.Now()
	tried := 0
	var lastErr error
	for tried < len(m.subs) {
		sub := m.nextAvailable(now)
		if sub == nil {
			if lastErr != nil {
				return Response{}, fmt.Errorf("%w: %v", ErrAllProvidersUnavailable, lastErr)
			}
			return Response{}, ErrAllProvidersUnavailable
		}
		resp, err := sub.driver.Chat(ctx, model, req)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		// Rate-limit / auth → cooldown + try next; прочие → return as-is.
		if errors.Is(err, ErrRateLimited) || errors.Is(err, ErrUnauthorized) {
			m.handleErr(sub, err)
			tried++
			continue
		}
		return resp, fmt.Errorf("llmchain.MultiKeyDriver.Chat: %w", err)
	}
	if lastErr != nil {
		return Response{}, fmt.Errorf("%w: %v", ErrAllProvidersUnavailable, lastErr)
	}
	return Response{}, ErrAllProvidersUnavailable
}

// ChatStream — аналогично Chat, но поток открывается на первом успешном
// ключе. Если первый ключ возвращает ошибку ДО первого chunk'а
// (connection/429/auth) — пробуем следующий; in-stream errors
// проксируем как есть caller'у.
func (m *MultiKeyDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	now := time.Now()
	tried := 0
	var lastErr error
	for tried < len(m.subs) {
		sub := m.nextAvailable(now)
		if sub == nil {
			if lastErr != nil {
				return nil, fmt.Errorf("%w: %v", ErrAllProvidersUnavailable, lastErr)
			}
			return nil, ErrAllProvidersUnavailable
		}
		ch, err := sub.driver.ChatStream(ctx, model, req)
		if err == nil {
			return ch, nil
		}
		lastErr = err
		if errors.Is(err, ErrRateLimited) || errors.Is(err, ErrUnauthorized) {
			m.handleErr(sub, err)
			tried++
			continue
		}
		return nil, fmt.Errorf("llmchain.MultiKeyDriver.ChatStream: %w", err)
	}
	if lastErr != nil {
		return nil, fmt.Errorf("%w: %v", ErrAllProvidersUnavailable, lastErr)
	}
	return nil, ErrAllProvidersUnavailable
}
