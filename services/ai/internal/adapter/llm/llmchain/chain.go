package llmchain

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"
)

// Chain orchestrates multiple Driver instances. It is the primary public
// type callers use: service-level code takes a *Chain, not individual
// Drivers.
//
// Threading model: Chain is safe for concurrent use. Rate-limit state
// lives in a sync.Map keyed by "<provider>/<model>" and each value is a
// *rateState with its own mutex. The happy path is lock-free apart from
// the one map load.
type Chain struct {
	drivers  map[Provider]Driver
	order    []Provider // resolved priority (healthy providers, in order) — static defaults
	taskMap  TaskModelMap
	state    sync.Map // key: provider+"/"+model → *rateState
	latency  *latencyStore
	log      *slog.Logger
	clock    Clock
	timeouts map[Provider]time.Duration
	// Default cooldowns applied when a provider returns a typed error
	// without a header hint. Tunable for tests.
	defaultCooldowns    cooldownPolicy
	healthProbeInterval time.Duration
	// runtimeCfg — optional runtime-loaded overrides (from DB). Когда
	// непустой snapshot активен — методы currentOrder/currentTaskMap/
	// currentVirtualChains возвращают его значения; иначе падают на
	// static defaults (order/taskMap/virtualChains). nil — runtime reload
	// отключён (unit-tests / в startup до wire-up loader'а).
	runtimeCfg *configLoader
}

// cooldownPolicy holds the baked-in durations for each error class.
// Rendered explicit so operators can see (in one place) how long a
// provider stays out of the rotation after each failure type.
type cooldownPolicy struct {
	rateLimit    time.Duration // 429 without Retry-After → 30s
	providerDown time.Duration // 5xx / transport → 60s
	unauthorized time.Duration // 401/403/402 → 1h (operator action needed)
}

var defaultPolicy = cooldownPolicy{
	rateLimit:    30 * time.Second,
	providerDown: 60 * time.Second,
	unauthorized: 1 * time.Hour,
}

// defaultTimeouts — cascading attempt timeouts. Groq is fast; there's
// no point waiting 45s for it — if it isn't responding in 10s something
// is wrong, move on. OpenRouter includes paid Claude which can take
// significantly longer on long prompts.
var defaultTimeouts = map[Provider]time.Duration{
	ProviderGroq:       25 * time.Second,
	ProviderCerebras:   30 * time.Second,
	ProviderMistral:    30 * time.Second,
	ProviderOpenRouter: 45 * time.Second,
	ProviderDeepSeek:   30 * time.Second,
	Provider("openai"): 30 * time.Second,
	ProviderGoogle:     30 * time.Second,
}

// Options configures a new Chain.
type Options struct {
	// Order is the priority of providers to try, front to back. Providers
	// not in this list are ignored even if a driver was registered for
	// them. Zero value → natural order from drivers (random map iteration),
	// so callers almost always set this.
	Order []Provider

	// TaskMap overrides the default task → model mapping. nil ⇒ use
	// DefaultTaskModelMap (cloned so this chain's edits don't leak).
	TaskMap TaskModelMap

	// Timeouts overrides the default per-provider attempt deadline. nil ⇒
	// defaultTimeouts. Missing keys fall back to the default.
	Timeouts map[Provider]time.Duration

	// Clock — test seam. nil ⇒ time.Now.
	Clock Clock

	// Log is required (anti-fallback policy: no silent noop loggers).
	Log *slog.Logger

	// RuntimeConfigSource — опциональный источник данных для динамической
	// конфигурации chain'а (порядок / task-map / virtual-chains из БД).
	// nil → runtime reload отключён, chain работает только с hardcoded
	// defaults. Когда задан — конструктор стартует background refresh
	// goroutine через NewChain → context.
	RuntimeConfigSource ConfigSource

	// RuntimeRefreshInterval — как часто loader опрашивает источник.
	// 0 → 30s default. Админ-PUT форсит reload вне тика.
	RuntimeRefreshInterval time.Duration

	// RuntimeCtx — контекст для background refresh goroutine. nil →
	// background.Background(). Обычно wiring передаёт ctx приложения,
	// чтобы graceful shutdown останавливал loader.
	RuntimeCtx context.Context

	// HealthProbeInterval controls how often cooled provider/model pairs
	// are tested before being returned to user traffic. Zero defaults to
	// one hour; negative disables background probes for tests.
	HealthProbeInterval time.Duration
}

// NewChain builds the orchestrator. Drivers with nil entries are
// ignored — the wirer skips registration when the API key is empty.
func NewChain(drivers map[Provider]Driver, opts Options) (*Chain, error) {
	if opts.Log == nil {
		return nil, fmt.Errorf("llmchain.NewChain: logger is required (anti-fallback policy)")
	}
	if len(drivers) == 0 {
		return nil, fmt.Errorf("llmchain.NewChain: at least one driver is required")
	}

	// Filter order to registered drivers, preserving priority.
	var order []Provider
	if len(opts.Order) > 0 {
		for _, p := range opts.Order {
			if _, ok := drivers[p]; ok {
				order = append(order, p)
			} else {
				opts.Log.Warn("llmchain: Options.Order mentions unregistered provider — skipped",
					slog.String("provider", string(p)))
			}
		}
	} else {
		// Fall back to map iteration (deterministic ORDER is the caller's
		// job); we don't sort because callers must be explicit.
		for p := range drivers {
			order = append(order, p)
		}
	}
	if len(order) == 0 {
		return nil, fmt.Errorf("llmchain.NewChain: no usable providers after filtering against registered drivers")
	}

	taskMap := opts.TaskMap
	if taskMap == nil {
		taskMap = DefaultTaskModelMap.Clone()
	}
	timeouts := make(map[Provider]time.Duration, len(defaultTimeouts))
	for p, d := range defaultTimeouts {
		timeouts[p] = d
	}
	for p, d := range opts.Timeouts {
		timeouts[p] = d
	}
	clock := opts.Clock
	if clock == nil {
		clock = time.Now
	}

	c := &Chain{
		drivers:          drivers,
		order:            order,
		taskMap:          taskMap,
		latency:          newLatencyStore(defaultWindowSize),
		log:              opts.Log,
		clock:            clock,
		timeouts:         timeouts,
		defaultCooldowns: defaultPolicy,
	}
	c.healthProbeInterval = opts.HealthProbeInterval
	if c.healthProbeInterval == 0 {
		c.healthProbeInterval = time.Hour
	}

	// Runtime config loader. Если оператор не прицепил ConfigSource — chain
	// живёт на static defaults (как раньше). Иначе — стартуем background
	// goroutine, читающую свежие снэпшоты из БД.
	if opts.RuntimeConfigSource != nil {
		loader := newConfigLoader(opts.RuntimeConfigSource, opts.RuntimeRefreshInterval, opts.Log)
		c.runtimeCfg = loader
		ctx := opts.RuntimeCtx
		if ctx == nil {
			ctx = context.Background()
		}
		go loader.run(ctx)
	}
	if c.healthProbeInterval > 0 {
		ctx := opts.RuntimeCtx
		if ctx == nil {
			ctx = context.Background()
		}
		go c.runHealthProbes(ctx)
	}
	return c, nil
}

// RuntimeForceReload — форсит немедленную загрузку config'а из источника.
// Используется admin-PUT handler'ом после успешной записи в БД, чтобы
// изменения вступали в силу без ожидания 30s tick'а.
func (c *Chain) RuntimeForceReload(ctx context.Context) {
	if c.runtimeCfg != nil {
		c.runtimeCfg.forceReload(ctx)
	}
}

func (c *Chain) TestProviderModel(ctx context.Context, provider Provider, model, prompt string) (Response, error) {
	d, ok := c.drivers[provider]
	if !ok {
		return Response{}, fmt.Errorf("%w: %s", ErrNoProvider, provider)
	}
	if strings.TrimSpace(prompt) == "" {
		prompt = "Reply with exactly: ok"
	}
	attemptCtx, cancel := c.attemptContext(ctx, provider, 0)
	defer cancel()
	resp, err := d.Chat(attemptCtx, model, Request{
		Temperature: 0,
		MaxTokens:   64,
		Messages: []Message{
			{Role: RoleUser, Content: prompt},
		},
	})
	if err != nil {
		return resp, fmt.Errorf("llmchain.HealthProbe: %w", err)
	}
	return resp, nil
}

func (c *Chain) runHealthProbes(ctx context.Context) {
	t := time.NewTicker(c.healthProbeInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			c.healthProbeOnce(ctx)
		}
	}
}

func (c *Chain) healthProbeOnce(ctx context.Context) {
	now := c.clock()
	c.state.Range(func(_, v any) bool {
		state, ok := v.(*rateState)
		if !ok {
			return true
		}
		provider, model, due := state.probeDue(now)
		if !due {
			return true
		}
		driver, ok := c.drivers[provider]
		if !ok {
			state.block(now.Add(c.healthProbeInterval), "health probe: driver unavailable")
			return true
		}
		probeCtx, cancel := c.attemptContext(ctx, provider, 0)
		_, err := driver.Chat(probeCtx, model, Request{
			Task:        TaskSummarize,
			Temperature: 0,
			MaxTokens:   1,
			Messages: []Message{
				{Role: RoleUser, Content: "health check: reply ok"},
			},
		})
		cancel()
		if err == nil {
			state.clear()
			c.log.InfoContext(ctx, "llmchain.health: candidate restored",
				slog.String("provider", string(provider)),
				slog.String("model", model))
			return true
		}
		state.block(now.Add(c.healthProbeInterval), "health probe failed")
		c.log.WarnContext(ctx, "llmchain.health: candidate still failing",
			slog.String("provider", string(provider)),
			slog.String("model", model),
			slog.Any("err", err))
		return true
	})
}

// RegisteredProviders возвращает имена всех зарегистрированных провайдеров
// (те, у которых API-ключ был в env на момент NewChain). Нужно admin-UI
// чтобы live-preview знал, какие звенья цепочки реально достижимы, а
// какие будут silently скипнуты при expandVirtualChain.
//
// Порядок НЕ сортируется — отдаём как есть (map iteration). Фронт
// сортирует сам если нужно.
func (c *Chain) RegisteredProviders() []string {
	out := make([]string, 0, len(c.drivers))
	for p := range c.drivers {
		out = append(out, string(p))
	}
	return out
}

// currentOrder — вернёт runtime-заданный порядок если есть (непустой
// ChainOrder в snapshot'е) либо static c.order. Сохраняет гарантию что
// в результат попадают только registered-драйверы (фильтрация по
// c.drivers).
func (c *Chain) currentOrder() []Provider {
	if c.runtimeCfg != nil {
		if snap := c.runtimeCfg.snapshot(); snap != nil && len(snap.ChainOrder) > 0 {
			out := make([]Provider, 0, len(snap.ChainOrder))
			for _, p := range snap.ChainOrder {
				if _, ok := c.drivers[p]; ok {
					out = append(out, p)
				}
			}
			if len(out) > 0 {
				return out
			}
		}
	}
	return c.order
}

// currentTaskMap — runtime-заданный TaskModelMap или c.taskMap. Если
// runtime-map неполный (нет нужного task'а) — дополняем static-default'ами
// по недостающим ключам.
func (c *Chain) currentTaskMap() TaskModelMap {
	if c.runtimeCfg != nil {
		if snap := c.runtimeCfg.snapshot(); snap != nil && len(snap.TaskMap) > 0 {
			merged := c.taskMap.Clone()
			for task, inner := range snap.TaskMap {
				if len(inner) == 0 {
					continue
				}
				merged[task] = inner
			}
			return merged
		}
	}
	return c.taskMap
}

// currentVirtualChains — runtime-заданные виртуалки или static virtualChains
// из tier.go. Ключи-override'ы заменяют defaults one-by-one.
func (c *Chain) currentVirtualChains() map[string][]VirtualCandidate {
	if c.runtimeCfg != nil {
		if snap := c.runtimeCfg.snapshot(); snap != nil && len(snap.VirtualChains) > 0 {
			merged := make(map[string][]VirtualCandidate, len(virtualChains))
			for k, v := range virtualChains {
				merged[k] = v
			}
			for k, v := range snap.VirtualChains {
				if len(v) > 0 {
					merged[k] = v
				}
			}
			return merged
		}
	}
	return virtualChains
}

// ─────────────────────────────────────────────────────────────────────────
// Public entry points.
// ─────────────────────────────────────────────────────────────────────────

// Chat is the non-streaming path. Walks the chain until a success or
// every candidate fails with a retryable class (→ AllProvidersUnavailableError).
// Fatal classes (ErrBadRequest / ErrUnauthorized at the *call* level) short-circuit.
func (c *Chain) Chat(ctx context.Context, req Request) (Response, error) {
	candidates, err := c.candidates(req)
	if err != nil {
		return Response{}, err
	}
	attempts := make([]AttemptError, 0, len(candidates))
	for _, cand := range candidates {
		if block, _, reason := c.stateOf(cand.provider, cand.model).blocked(c.clock()); block {
			attempts = append(attempts, AttemptError{
				Provider: cand.provider, Model: cand.model,
				Err: fmt.Errorf("cooled: %s", reason),
			})
			incFallback(cand.provider, "cooled")
			continue
		}
		attemptCtx, cancel := c.attemptContext(ctx, cand.provider, req.AttemptTimeout)
		start := c.clock()
		resp, cerr := cand.driver.Chat(attemptCtx, cand.model, req)
		cancel()
		if cerr == nil {
			dur := c.clock().Sub(start)
			c.recordSuccess(cand.provider, cand.model, nil)
			c.latency.Record(cand.provider, cand.model, req.Task, dur)
			observeCall(cand.provider, string(req.Task), "ok", dur)
			// Cost telemetry per successful call.
			// Используем echo-model из Response — для virtual chains
			// это реальная модель, не "druz9/turbo".
			echoModel := resp.Model
			if echoModel == "" {
				echoModel = cand.model
			}
			observeCostWithUser(cand.provider, string(req.Task), echoModel, req.UserID,
				resp.TokensIn, resp.TokensOut, int(dur.Milliseconds()))
			return resp, nil
		}
		dur := c.clock().Sub(start)
		attempts = append(attempts, AttemptError{
			Provider: cand.provider, Model: cand.model,
			Status: statusOf(cerr), Err: cerr, Duration: dur,
		})
		observeCall(cand.provider, string(req.Task), classLabel(cerr), dur)
		if decision := c.handleError(cand.provider, cand.model, cerr); decision == decisionFatal {
			return Response{}, fmt.Errorf("llmchain.Chat: %w", cerr)
		}
	}
	return Response{}, &AllProvidersUnavailableError{Task: effectiveTaskFor(req), Attempts: attempts}
}

// ChatStream is the streaming path. Fallback is attempted ONLY on
// pre-first-chunk failures (connection / 429 / 5xx / auth). Once a
// provider has started streaming we commit to it — mid-stream errors
// propagate as StreamEvent{Err} to the caller.
func (c *Chain) ChatStream(ctx context.Context, req Request) (<-chan StreamEvent, error) {
	candidates, err := c.candidates(req)
	if err != nil {
		// Конфигурационная или tier-ошибка — кандидаты вообще не построились.
		// Лог на Warn с подробностями: оператор сразу видит что сломалось
		// (no providers configured / unknown virtual / tier-mismatch).
		c.log.WarnContext(ctx, "llmchain.ChatStream: no candidates",
			slog.String("task", string(req.Task)),
			slog.String("model_override", req.ModelOverride),
			slog.Bool("has_images", hasImages(req.Messages)),
			slog.Any("err", err))
		return nil, err
	}
	attempts := make([]AttemptError, 0, len(candidates))
	for _, cand := range candidates {
		if block, _, reason := c.stateOf(cand.provider, cand.model).blocked(c.clock()); block {
			attempts = append(attempts, AttemptError{
				Provider: cand.provider, Model: cand.model,
				Err: fmt.Errorf("cooled: %s", reason),
			})
			incFallback(cand.provider, "cooled")
			c.log.InfoContext(ctx, "llmchain.ChatStream: candidate cooled, skipping",
				slog.String("task", string(req.Task)),
				slog.String("provider", string(cand.provider)),
				slog.String("model", cand.model),
				slog.String("reason", reason))
			continue
		}
		// Unlike Chat, ChatStream must keep the context alive for the
		// *entire* stream, so we don't attach a per-attempt deadline to
		// the parent. We do still set a "time to first byte" ceiling via
		// the HTTP Transport's ResponseHeaderTimeout (60s, baked in). If
		// the upstream stalls on headers, that fires and returns
		// ErrProviderDown before any chunk arrives — handled below.
		start := c.clock()
		ch, cerr := cand.driver.ChatStream(ctx, cand.model, req)
		if cerr == nil {
			// For streams, "latency" = time-to-first-chunk. That's what the
			// user actually feels on a streaming UI; full-stream duration
			// is dominated by content length which we don't control.
			dur := c.clock().Sub(start)
			c.recordSuccess(cand.provider, cand.model, nil)
			c.latency.Record(cand.provider, cand.model, req.Task, dur)
			observeCall(cand.provider, string(req.Task), "stream_started", dur)
			c.log.InfoContext(ctx, "llmchain.ChatStream: stream started",
				slog.String("task", string(req.Task)),
				slog.String("provider", string(cand.provider)),
				slog.String("model", cand.model),
				slog.Bool("has_images", hasImages(req.Messages)),
				slog.Duration("ttfb", dur))
			return c.observeStreamWithUser(ctx, cand, req.Task, req.UserID, ch), nil
		}
		dur := c.clock().Sub(start)
		attempts = append(attempts, AttemptError{
			Provider: cand.provider, Model: cand.model,
			Status: statusOf(cerr), Err: cerr, Duration: dur,
		})
		observeCall(cand.provider, string(req.Task), classLabel(cerr), dur)
		// Per-attempt failure лог. Включает classLabel (rate_limited /
		// model_not_supported / provider_down / etc) — это категория, по
		// которой можно грепать и алертить. err.Error() — полный текст
		// апстримового ответа (для OpenRouter это включает «No endpoints
		// found for ...» — сразу видно что модель умерла из их каталога).
		c.log.WarnContext(ctx, "llmchain.ChatStream: candidate failed",
			slog.String("task", string(req.Task)),
			slog.String("provider", string(cand.provider)),
			slog.String("model", cand.model),
			slog.String("class", classLabel(cerr)),
			slog.Duration("dur", dur),
			slog.Any("err", cerr))
		if decision := c.handleError(cand.provider, cand.model, cerr); decision == decisionFatal {
			return nil, fmt.Errorf("llmchain.ChatStream: %w", cerr)
		}
	}
	// Все провайдеры пройдены, ни один не дал стрим. Финальный summary-лог
	// с агрегацией по providers — с ним один grep даёт картину «почему
	// vision сегодня лежит». Без этого админу приходилось бы листать
	// per-attempt warnings в общем потоке.
	failures := make([]any, 0, len(attempts)*5)
	for _, a := range attempts {
		failures = append(failures,
			slog.Group(string(a.Provider),
				slog.String("model", a.Model),
				slog.Int("status", a.Status),
				slog.String("err", errString(a.Err))))
	}
	c.log.ErrorContext(ctx, "llmchain.ChatStream: all candidates failed",
		slog.String("task", string(req.Task)),
		slog.Int("attempts", len(attempts)),
		slog.Group("by_provider", failures...))
	return nil, &AllProvidersUnavailableError{Task: req.Task, Attempts: attempts}
}

// errString — nil-safe Error().
func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// observeStreamWithUser оборачивает source-чан StreamEvent'ов: на error-frame'е
// помечает кандидата cooled, на Done-frame'е эмитит usage/cost telemetry с
// userID для admin audit log.
func (c *Chain) observeStreamWithUser(ctx context.Context, cand candidate, task Task, userID string, src <-chan StreamEvent) <-chan StreamEvent {
	out := make(chan StreamEvent, 16)
	go func() {
		defer close(out)
		for ev := range src {
			if ev.Err != nil {
				c.handleError(cand.provider, cand.model, ev.Err)
				c.log.WarnContext(ctx, "llmchain.ChatStream: stream failed after start, candidate cooled",
					slog.String("task", string(task)),
					slog.String("provider", string(cand.provider)),
					slog.String("model", cand.model),
					slog.Any("err", ev.Err))
			}
			// Cost telemetry на терминальном Done-frame'е.
			// SSE возвращает usage только в финальном chunk'е (или
			// иногда не возвращает вообще — тогда tokens=0 и
			// observeCost ничего не пишет).
			if ev.Done != nil {
				echoModel := ev.Done.Model
				if echoModel == "" {
					echoModel = cand.model
				}
				observeCostWithUser(cand.provider, string(task), echoModel, userID,
					ev.Done.TokensIn, ev.Done.TokensOut, 0)
			}
			out <- ev
		}
	}()
	return out
}

// effectiveTaskFor — какой task на самом деле гнать через chain. Если
// в request'е есть images, а task не TaskVision — переключаемся.
// Делается в одном месте чтобы и candidates(), и error-construction
// (AllProvidersUnavailableError.Task) видели одинаковую истину.
func effectiveTaskFor(req Request) Task {
	if req.Task != TaskVision && hasImages(req.Messages) {
		return TaskVision
	}
	return req.Task
}
