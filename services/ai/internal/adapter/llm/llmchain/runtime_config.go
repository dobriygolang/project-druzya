package llmchain

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"
)

// RuntimeConfig — snapshot конфигурации chain'а, хранимой в БД и
// обновляемой админом через /api/v1/admin/llm/config. Пустые поля =
// "использовать hardcoded defaults" (смотри tier.go, task_map.go).
type RuntimeConfig struct {
	// Version — монотонный счётчик. Админ-PUT присылает expected version;
	// UPDATE проходит только если cur = expected (optimistic lock).
	Version int64
	// ChainOrder — порядок провайдеров для task-based candidates. Пустой →
	// используем Chain.order (из LLM_CHAIN_ORDER env на старте).
	ChainOrder []Provider
	// TaskMap — override TaskModelMap. Пустой map / отсутствие ключа task →
	// fallback на DefaultTaskModelMap.
	TaskMap TaskModelMap
	// VirtualChains — override для druz9/turbo|pro|ultra|reasoning. Пустой
	// → используем tier.go:virtualChains. Админ может вставить entry для
	// одного virtual id, остальные остаются на defaults.
	VirtualChains map[string][]VirtualCandidate
}

// ConfigSource — порт для чтения/записи RuntimeConfig. В prod реализуется
// Postgres'ом (см. services/admin/infra/llm_config_pg.go). В тестах —
// in-memory stub.
type ConfigSource interface {
	Load(ctx context.Context) (*RuntimeConfig, error)
	Save(ctx context.Context, cfg *RuntimeConfig, expectedVersion int64) error
}

// configLoader — atomic wrapper над RuntimeConfig. Chain читает через
// snapshot() (lock-free), фоновая goroutine обновляет раз в refresh.
type configLoader struct {
	ptr     atomic.Pointer[RuntimeConfig]
	src     ConfigSource
	refresh time.Duration
	log     *slog.Logger
}

// newConfigLoader — конструктор. src может быть nil (тогда все snapshot'ы
// вернут nil → Chain использует hardcoded defaults). refresh ≤ 0 → 30s.
func newConfigLoader(src ConfigSource, refresh time.Duration, log *slog.Logger) *configLoader {
	if refresh <= 0 {
		refresh = 30 * time.Second
	}
	return &configLoader{src: src, refresh: refresh, log: log}
}

// snapshot возвращает текущий loaded config (или nil если ещё не загрузили
// или source nil). Lock-free.
func (l *configLoader) snapshot() *RuntimeConfig {
	if l == nil {
		return nil
	}
	return l.ptr.Load()
}

// run — background-goroutine. Вызывает Load каждые refresh секунд, если
// Load вернул не-nil config — кладёт в atomic ptr. Ошибки логируются
// и не мешают продолжению (fail-open to current snapshot).
//
// Стартует с немедленного initial load, затем периодический tick. Останавливается
// по ctx.Done(). Запуск через cmd/monolith/bootstrap при wire-up llmchain.
func (l *configLoader) run(ctx context.Context) {
	if l == nil || l.src == nil {
		return
	}
	// Initial load — без ожидания первого tick'а.
	l.loadOnce(ctx)
	t := time.NewTicker(l.refresh)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			l.loadOnce(ctx)
		}
	}
}

// loadOnce — один tick. Error'ы логируются (не прибивают goroutine).
func (l *configLoader) loadOnce(ctx context.Context) {
	cfg, err := l.src.Load(ctx)
	if err != nil {
		if l.log != nil {
			l.log.WarnContext(ctx, "llmchain.configLoader: load failed — keeping previous snapshot",
				slog.Any("err", err))
		}
		return
	}
	if cfg == nil {
		return
	}
	l.ptr.Store(cfg)
}

// forceReload — для админ-PUT: после записи в БД сразу тянем свежий config
// в atomic, чтобы изменения вступали в силу мгновенно без ожидания 30s
// tick'а.
func (l *configLoader) forceReload(ctx context.Context) {
	if l == nil || l.src == nil {
		return
	}
	l.loadOnce(ctx)
}
