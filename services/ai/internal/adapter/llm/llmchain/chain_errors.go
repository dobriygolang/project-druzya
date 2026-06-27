package llmchain

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

// chainDecision говорит, что делать с текущим candidate'ом после fail'а:
// идти к следующему (decisionFallThrough) или сразу вернуть caller'у
// (decisionFatal — same input failed identically на любой провайдер).
type chainDecision int

const (
	decisionFallThrough chainDecision = iota
	decisionFatal
)

// handleError выбирает cooldown по error-классу и решает, продолжить ли
// chain. Также вытягивает rate-limit headers из httpStatusError —
// proactive cooldown обновляется и на rejected calls.
func (c *Chain) handleError(p Provider, model string, err error) chainDecision {
	state := c.stateOf(p, model)
	now := c.clock()

	// Cross-hook: HTTP status carries rate-limit headers on some 429s.
	var hse *httpStatusError
	if errors.As(err, &hse) {
		if rem, reset := parseRateLimitHeaders(p, hse.Headers(), now); rem >= 0 {
			state.recordResponse(rem, reset)
		}
	}

	switch {
	case errors.Is(err, ErrRateLimited):
		cooldown := c.defaultCooldowns.rateLimit
		if hse != nil {
			if ra := parseRetryAfter(hse.Headers().Get("Retry-After"), now); ra > cooldown {
				cooldown = ra
			}
		}
		if c.healthProbeInterval > 0 && cooldown < c.healthProbeInterval {
			cooldown = c.healthProbeInterval
		}
		state.blockWithProbe(now.Add(cooldown), "rate-limited", c.healthProbeInterval > 0)
		c.log.Warn("llmchain: provider rate-limited, falling through",
			slog.String("provider", string(p)),
			slog.String("model", model),
			slog.Duration("cooldown", cooldown))
		return decisionFallThrough

	case errors.Is(err, ErrProviderDown), errors.Is(err, ErrTimeout):
		cooldown := c.defaultCooldowns.providerDown
		if c.healthProbeInterval > 0 && cooldown < c.healthProbeInterval {
			cooldown = c.healthProbeInterval
		}
		state.blockWithProbe(now.Add(cooldown), "provider down", c.healthProbeInterval > 0)
		c.log.Warn("llmchain: provider down, falling through",
			slog.String("provider", string(p)),
			slog.String("model", model),
			slog.Any("err", err))
		return decisionFallThrough

	case errors.Is(err, ErrUnauthorized):
		cooldown := c.defaultCooldowns.unauthorized
		if c.healthProbeInterval > 0 && cooldown < c.healthProbeInterval {
			cooldown = c.healthProbeInterval
		}
		state.blockWithProbe(now.Add(cooldown), "unauthorized/payment required", c.healthProbeInterval > 0)
		// ERROR level — это operator-visible issue (wrong/expired key, out
		// of credits). Chain продолжает обход (call всё ещё может пройти на
		// другом провайдере), но alert уже горит.
		c.log.Error("llmchain: provider refused auth — operator action needed",
			slog.String("provider", string(p)),
			slog.String("model", model),
			slog.Any("err", err))
		return decisionFallThrough

	case errors.Is(err, ErrModelNotSupported):
		// Provider здоров; он просто не подходит под этот request (vision
		// на text-only). Skip cooldown, переходим дальше.
		return decisionFallThrough

	case errors.Is(err, ErrBadRequest):
		// Same-input провалится одинаково везде — не зажигаем следующий провайдер.
		return decisionFatal

	default:
		// Unclassified — conservatively treat as provider-down.
		cooldown := c.defaultCooldowns.providerDown
		if c.healthProbeInterval > 0 && cooldown < c.healthProbeInterval {
			cooldown = c.healthProbeInterval
		}
		state.blockWithProbe(now.Add(cooldown), "unknown error", c.healthProbeInterval > 0)
		c.log.Warn("llmchain: unclassified error, treating as provider-down",
			slog.String("provider", string(p)),
			slog.String("model", model),
			slog.Any("err", err))
		return decisionFallThrough
	}
}

// recordSuccess сбрасывает cooldown и (если caller передал headers)
// подтягивает свежие rate-limit-budget значения. Сегодня драйверы headers
// после успеха не пропускают — крюк оставлен для будущего расширения.
func (c *Chain) recordSuccess(p Provider, model string, h http.Header) {
	state := c.stateOf(p, model)
	state.clear()
	if h != nil {
		if rem, reset := parseRateLimitHeaders(p, h, c.clock()); rem >= 0 {
			state.recordResponse(rem, reset)
		}
	}
}

func (c *Chain) stateOf(p Provider, model string) *rateState {
	key := string(p) + "/" + model
	if v, ok := c.state.Load(key); ok {
		return v.(*rateState)
	}
	fresh := &rateState{provider: p, model: model}
	actual, _ := c.state.LoadOrStore(key, fresh)
	return actual.(*rateState)
}

func (c *Chain) attemptContext(ctx context.Context, p Provider, override time.Duration) (context.Context, context.CancelFunc) {
	d := c.timeouts[p]
	if override > 0 {
		d = override
	}
	if d <= 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, d)
}

// statusOf вытягивает HTTP status из error, если какой-то driver-слой
// обернул его в httpStatusError.
func statusOf(err error) int {
	var hse *httpStatusError
	if errors.As(err, &hse) {
		return hse.Status()
	}
	return 0
}

// classLabel — короткий status-label для метрик и логов.
func classLabel(err error) string {
	switch {
	case err == nil:
		return "ok"
	case errors.Is(err, ErrRateLimited):
		return "rate_limited"
	case errors.Is(err, ErrProviderDown):
		return "provider_down"
	case errors.Is(err, ErrTimeout):
		return "timeout"
	case errors.Is(err, ErrUnauthorized):
		return "unauthorized"
	case errors.Is(err, ErrBadRequest):
		return "bad_request"
	case errors.Is(err, ErrModelNotSupported):
		return "not_supported"
	default:
		return "unknown"
	}
}
