package llmchain

import (
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"
)

type candidate struct {
	provider Provider
	model    string
	driver   Driver
}

// candidates строит упорядоченный список кандидатов для текущего request'а.
//
// Три источника правды (в порядке проверки):
//
//  1. ModelOverride с префиксом "druz9/" — виртуальная цепочка. Раскрывается
//     через runtime/virtual chains; tier-gate ДО expand'а, чтобы free-юзер
//     не видел состав paid-цепочки в error message.
//  2. ModelOverride без префикса "druz9/" — pinned-модель, single candidate.
//     Tier-gate + capability check; на mismatch — typed error, без fallback.
//  3. Task — task-routing через TaskModelMap. Vision-images авто-роутятся в
//     TaskVision если оригинальный task — text-only. Latency-reorder
//     поднимает warm-providers; cold-start уважает LLM_CHAIN_ORDER через
//     стабильную сортировку.
func (c *Chain) candidates(req Request) ([]candidate, error) {
	if IsVirtualModel(req.ModelOverride) {
		virtualID := ResolveVirtualModelID(req.ModelOverride)
		required, ok := VirtualModelMinTier[virtualID]
		if !ok {
			return nil, fmt.Errorf("%w: unknown virtual model %q", ErrNoProvider, req.ModelOverride)
		}
		if !TierCovers(req.UserTier, required) {
			return nil, fmt.Errorf("%w: %q needs %s, got %s",
				ErrTierRequired, req.ModelOverride, required, effectiveTier(req.UserTier))
		}
		chains := c.currentVirtualChains()
		vChain, ok := chains[virtualID]
		if !ok && virtualID != req.ModelOverride {
			vChain, ok = chains[req.ModelOverride]
		}
		if !ok {
			return nil, fmt.Errorf("%w: no chain for virtual %q", ErrNoProvider, req.ModelOverride)
		}
		expanded := c.expandVirtualChain(vChain)
		// Filter virtual chain by capability. Если ни один шаг
		// не удовлетворяет требованиям (например JSON-задача, а в чейне
		// только text-only providers) — typed error.
		filtered := make([]candidate, 0, len(expanded))
		for _, ca := range expanded {
			if driverSatisfies(ca.driver, req) {
				filtered = append(filtered, ca)
			}
		}
		if len(filtered) == 0 {
			return nil, fmt.Errorf("%w: virtual %q has no capability-matching providers (json_mode=%v, tools=%v)",
				ErrNoProvider, req.ModelOverride, req.JSONMode, req.RequiresTools)
		}
		return filtered, nil
	}

	if req.ModelOverride != "" {
		// Concrete model picked — single candidate, no fallback.
		// Tier-gate проверяет что paid-модель доступна юзеру.
		if required := ModelRequiresTier(req.ModelOverride); !TierCovers(req.UserTier, required) {
			return nil, fmt.Errorf("%w: %q needs %s, got %s",
				ErrTierRequired, req.ModelOverride, required, effectiveTier(req.UserTier))
		}
		p := providerFromModelID(req.ModelOverride)
		d, ok := c.drivers[p]
		if !ok {
			return nil, fmt.Errorf("%w: %s for model %q", ErrNoProvider, p, req.ModelOverride)
		}
		// Pinned-модель + capability mismatch = config error (admin
		// запинил JSON-задачу к text-only-driver'у). Возвращаем typed
		// error, иначе бы caller получил silent text-ответ.
		if !driverSatisfies(d, req) {
			return nil, fmt.Errorf("%w: pinned model %q lacks required capability (json_mode=%v, tools=%v)",
				ErrNoProvider, req.ModelOverride, req.JSONMode, req.RequiresTools)
		}
		return []candidate{{provider: p, model: req.ModelOverride, driver: d}}, nil
	}
	if req.Task == "" {
		return nil, fmt.Errorf("%w: neither Task nor ModelOverride set", ErrBadRequest)
	}
	// Vision auto-routing: скриншот, отправленный copilot'у с TaskCopilotStream,
	// иначе цеплял бы первый text-only провайдер из text-chain'а, падал бы
	// с ErrModelNotSupported, и chain бы пробежал по всем text-провайдерам
	// подряд — итог AllProvidersUnavailableError. Vision-модели одинаково
	// хорошо обрабатывают чисто-текстовые сообщения, переключение безопасно.
	effectiveTask := effectiveTaskFor(req)
	if effectiveTask != req.Task {
		c.log.Info("llmchain.candidates: switching to vision task",
			slog.String("requested", string(req.Task)),
			slog.String("effective", string(effectiveTask)))
	}
	// Runtime-config предпочитается static'у — админ может менять порядок
	// и task-map через БД без рестарта.
	order := c.currentOrder()
	taskMap := c.currentTaskMap()
	out := make([]candidate, 0, len(order))
	for _, p := range order {
		model := taskMap.ModelFor(effectiveTask, p)
		if model == "" {
			continue
		}
		// Tier-gate: пропускаем paid-модели для юзеров с недостаточным tier'ом.
		// По умолчанию все task-map модели free; defensive — если кто-то
		// добавит paid-модель в default map, tier-gate автоматом её отрежет.
		if required := ModelRequiresTier(model); !TierCovers(req.UserTier, required) {
			continue
		}
		d, ok := c.drivers[p]
		if !ok {
			continue
		}
		// Capability filter: JSON-strict / tool-strict задачи должны видеть
		// только драйверы которые wire-уровнево поддерживают фичу — иначе
		// failover уйдёт на text-only провайдер и парсер тихо словит plain
		// text вместо JSON.
		if !driverSatisfies(d, req) {
			continue
		}
		out = append(out, candidate{provider: p, model: model, driver: d})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("%w: no candidates for task %q", ErrNoProvider, effectiveTask)
	}
	// Passive latency reorder: warm-providers с ≥ minSamplesForReorder
	// samples поднимаются по recent p95. Cold providers сохраняют статический
	// порядок (LLM_CHAIN_ORDER). Cooled providers НЕ переставляются — они и
	// так отфильтруются на attempt-time state check.
	out = c.reorderByLatency(out, req.Task)
	return out, nil
}

// reorderByLatency делает stable-sort по recent p95. "Stable" критично:
// кандидаты без достаточного sample'а compare равны друг другу и warmed-up
// соседям, поэтому не прыгают. Как только провайдер набрал
// ≥ minSamplesForReorder samples — конкурирует по p95.
//
// Stable вместо unstable: при fresh deploy без истории оператор's
// LLM_CHAIN_ORDER должен победить. Unstable перетасовал бы их случайно;
// stable сохраняет static order как tiebreaker.
func (c *Chain) reorderByLatency(in []candidate, task Task) []candidate {
	if len(in) < 2 || task == "" {
		return in
	}
	// Сортируем только entry с известным p95; unknown-slot'ы сохраняют
	// свои оригинальные кандидаты — это эквивалент "cold-providers держат
	// static-order".
	type scored struct {
		c    candidate
		p95  time.Duration
		hasP bool
	}
	scoredList := make([]scored, len(in))
	hasAnyKnown := false
	for i, cand := range in {
		p, ok := c.latency.P95(cand.provider, cand.model, task)
		scoredList[i] = scored{c: cand, p95: p, hasP: ok}
		if ok {
			hasAnyKnown = true
		}
	}
	if !hasAnyKnown {
		return in // cold start: nothing to learn from yet
	}
	knownIdx := make([]int, 0, len(scoredList))
	for i, s := range scoredList {
		if s.hasP {
			knownIdx = append(knownIdx, i)
		}
	}
	slices.SortStableFunc(knownIdx, func(a, b int) int {
		if scoredList[a].p95 < scoredList[b].p95 {
			return -1
		}
		if scoredList[a].p95 > scoredList[b].p95 {
			return 1
		}
		return 0
	})
	out := make([]candidate, len(in))
	nextKnown := 0
	for i, s := range scoredList {
		if !s.hasP {
			out[i] = s.c
			continue
		}
		out[i] = scoredList[knownIdx[nextKnown]].c
		nextKnown++
	}
	return out
}

// providerFromModelID мэппит model id на провайдер. Распознаёт convention
// "<provider>/<model>" для Groq/Cerebras/Mistral; всё остальное считаем
// OpenRouter (OpenRouter сам ожидает "vendor/model").
func providerFromModelID(id string) Provider {
	// DeepSeek ids — без slash'а ("deepseek-chat", "deepseek-reasoner").
	// Exact-match, чтобы не путать с "deepseek-ai/..." от OpenRouter.
	if id == "deepseek-chat" || id == "deepseek-reasoner" {
		return ProviderDeepSeek
	}
	if idx := strings.Index(id, "/"); idx > 0 {
		prefix := Provider(id[:idx])
		switch prefix {
		case ProviderGroq,
			ProviderCerebras,
			ProviderMistral,
			ProviderOpenRouter,
			ProviderGoogle,
			ProviderCloudflare,
			ProviderZAI,
			ProviderDeepSeek,
			ProviderOllama:
			return prefix
		}
	}
	return ProviderOpenRouter
}

// expandVirtualChain превращает VirtualCandidate'ы (provider+model) в
// candidate'ы, подтягивая driver'ы из chain.drivers. Элементы без
// зарегистрированного драйвера ТИХО скипаются — соответствует семантике
// task-based candidates: если оператор не настроил key для OpenRouter,
// pro-цепочка просто "сожмётся" до работающих звеньев.
func (c *Chain) expandVirtualChain(vc []VirtualCandidate) []candidate {
	out := make([]candidate, 0, len(vc))
	for _, v := range vc {
		d, ok := c.drivers[v.Provider]
		if !ok {
			continue
		}
		out = append(out, candidate{provider: v.Provider, model: v.Model, driver: d})
	}
	return out
}

// effectiveTier подменяет пустое значение на "free" для error-сообщений.
func effectiveTier(t SubscriptionPlan) SubscriptionPlan {
	if t == "" {
		return SubscriptionPlanFree
	}
	return t
}

// driverSatisfies — capability filter. Возвращает true, если driver
// покрывает все требуемые Request фичи (JSONMode, RequiresTools). Без
// требований (text-задача) — всегда true.
func driverSatisfies(d Driver, req Request) bool {
	if !req.JSONMode && !req.RequiresTools {
		return true
	}
	caps := d.Capabilities()
	if req.JSONMode && !caps.JSONMode {
		return false
	}
	if req.RequiresTools && !caps.Tools {
		return false
	}
	return true
}
