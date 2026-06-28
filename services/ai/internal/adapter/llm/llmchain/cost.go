// cost.go — cost telemetry. Per-model USD rate table +
// observation hook. Цель: ops видит сколько $ уходит на coach / copilot
// в день, и админ принимает решение «пора переключить task X на более
// дешёвую модель».
//
// Дизайн:
//   - Hardcoded rate table — для MVP. Управляется через PR, а не админ-
//     UI: новый драйвер / model id обновляется одновременно с кодом.
//     После первого боя можно вынести в dynamic_config["llm_costs"].
//   - Cost = round(tokens × rate / 1e6). Прометей-counter в USD-центах
//     (uint64), деление на 100 на стороне dashboard.
//   - Unknown model → ноль cost, но в логе warn-once. Это видно в
//     druz9_llm_unknown_cost_total → ops знает что нужно обновить таблицу.
//
// Точность: rate-table это публичные list-prices провайдеров на момент
// обновления. Реальные счета могут отличаться (volume discount, prompt-
// cache). Для capacity planning точности достаточно.
package llmchain

import (
	"strings"
	"sync"
)

// modelCost — стоимость 1M tokens в USD для одной модели.
// in / out обычно различаются в 2-4 раза (out дороже).
type modelCost struct {
	inputUSDPerMillion  float64
	outputUSDPerMillion float64
}

// costTable — rate per model_id. Ключ обычно provider-prefixed
// ("openai/gpt-4o", "anthropic/claude-3-5-sonnet"), как они приходят
// в Response.Model.
//
// Цены на 2026-04-29; обновлять через PR при изменениях провайдеров.
// Данные взяты из публичных pricing pages соответствующих сайтов.
var costTable = map[string]modelCost{
	// OpenAI / OpenRouter
	"openai/gpt-4o":      {2.50, 10.00},
	"openai/gpt-4o-mini": {0.15, 0.60},
	"openai/gpt-4-turbo": {10.00, 30.00},
	"openai/o1-mini":     {1.10, 4.40},
	"openai/o1":          {15.00, 60.00},
	"openai/o3-mini":     {1.10, 4.40},
	// Anthropic
	"anthropic/claude-3-5-sonnet": {3.00, 15.00},
	"anthropic/claude-3-5-haiku":  {0.80, 4.00},
	"anthropic/claude-3-opus":     {15.00, 75.00},
	"anthropic/claude-3-haiku":    {0.25, 1.25},
	// Groq (super-cheap inference)
	"groq/llama-3.3-70b-versatile": {0.59, 0.79},
	"groq/llama-3.1-70b-versatile": {0.59, 0.79},
	"groq/llama-3.1-8b-instant":    {0.05, 0.08},
	"groq/llama-3.2-90b-vision":    {0.90, 0.90},
	// OpenAI gpt-oss-120b — reasoning-specialized open-weight model
	// hosted by Groq (production tier). Public Groq pricing 2026-Q2.
	// Response.Model echoes the bare model id, so both prefixed (если
	// нормализация в driver добавится) и неprefixed ключи покрыты.
	"groq/openai/gpt-oss-120b": {0.15, 0.60},
	"openai/gpt-oss-120b":      {0.15, 0.60},
	// Cerebras
	"cerebras/llama-3.3-70b": {0.85, 1.20},
	"cerebras/zai-glm-4.7":   {0.50, 0.50},
	"cerebras/gpt-oss-120b":  {0.35, 0.75},
	// Mistral
	"mistralai/mistral-large":  {2.00, 6.00},
	"mistralai/mistral-medium": {0.40, 2.00},
	"mistralai/mistral-small":  {0.20, 0.60},
	// Google Gemini (через generativelanguage API)
	"google/gemini-2.0-flash": {0, 0},
	"google/gemini-1.5-pro":   {1.25, 5.00},
	"google/gemini-1.5-flash": {0.075, 0.30},
	// DeepSeek (direct API — bare model ids in Response.Model)
	"deepseek-chat":     {0.27, 1.10},
	"deepseek-reasoner": {0.55, 2.19},
	"deepseek/deepseek-chat":     {0.27, 1.10},
	"deepseek/deepseek-reasoner": {0.55, 2.19},
	// Qwen / OpenRouter free
	"qwen/qwen3-coder:free": {0, 0},
	// DeepSeek R1 через OpenRouter free-tier — 671B reasoning model,
	// on-par с o1. Используется как top reasoning fallback в task_map
	// для критичных judging-задач (TaskCodeReview / TaskSysDesignCritique
	// / TaskReasoning / TaskCheckpointGrade / TaskMLEngMock).
	"deepseek/deepseek-r1:free": {0, 0},
	// :free suffix может срезаться в Response echo — держим оба ключа
	// чтобы lookup гарантированно матчил.
	"deepseek/deepseek-r1":     {0, 0},
	"openai/gpt-oss-120b:free": {0, 0},
	"google/gemma-3-27b-it:free": {0, 0},
	"@cf/meta/llama-3.1-8b-instruct-fast": {0, 0},
	"@cf/meta/llama-3.3-70b-instruct-fp8-fast": {0, 0},
	// Cloudflare Workers AI — все модели бесплатны до 10K request/day
	// на free-tier; платный tier ~$0.011/1k neurons. Trace минимальный,
	// ставим 0 для MVP, обновим когда CF выйдет на paid load.
	// Z.AI — платный tier, обновить при переключении.
}

// EstimateCostUSD возвращает оценку стоимости вызова в долларах.
// Unknown model → 0 + tracked через unknownModelCost для ops-видимости.
func EstimateCostUSD(model string, tokensIn, tokensOut int) float64 {
	rate, ok := costTable[strings.ToLower(model)]
	if !ok {
		incUnknownModelCost(model)
		return 0
	}
	return rate.inputUSDPerMillion*float64(tokensIn)/1e6 +
		rate.outputUSDPerMillion*float64(tokensOut)/1e6
}

// EstimateCostCents — convenience wrapper для callers, которые пишут
// integer cost cents в DB (admin LLM usage panel). Rounds half-away from
// zero так чтобы $0.005 → 1 cent (audit-friendly upper bound).
func EstimateCostCents(model string, tokensIn, tokensOut int) int {
	usd := EstimateCostUSD(model, tokensIn, tokensOut)
	cents := usd * 100
	// Round to nearest integer (math.Round semantics).
	if cents >= 0 {
		return int(cents + 0.5)
	}
	return int(cents - 0.5)
}

// InvocationEvent — single LLM call audit record. Emitted via the
// optional InvocationHook so admin / wiring code can persist to DB
// (table llm_invocations) without llmchain depending on pg.
type InvocationEvent struct {
	Provider     string
	Model        string
	TaskKind     string
	UserID       string // empty = system / no user context
	InputTokens  int
	OutputTokens int
	CostCents    int
	LatencyMs    int
}

// InvocationHook — caller-supplied write sink. Set in main.go's bootstrap
// after the chain is constructed; nil-safe (no-op when unset). Concurrency:
// caller's implementation MUST be safe for concurrent invocation — Chain
// calls fire goroutines.
//
// Stored as a package-level var (not a chain field) so all chain instances
// share the same audit pipeline. Tests can reset via SetInvocationHook(nil).
var invocationHook func(InvocationEvent)

// SetInvocationHook installs the audit-log writer. Passing nil disables.
func SetInvocationHook(h func(InvocationEvent)) {
	invocationHook = h
}

// emitInvocation — internal helper called from observeCost (Chat path)
// и observeStream (ChatStream path) so the admin audit log captures
// both modalities.
func emitInvocation(ev InvocationEvent) {
	if invocationHook == nil {
		return
	}
	// Hook fires inline (caller may async-queue from inside the hook).
	defer func() {
		// Don't let a broken hook destabilise the LLM hot path.
		_ = recover()
	}()
	invocationHook(ev)
}

// unknownModelCostOnce — keep "saw unknown model" log to once-per-model
// so ops alerting ловит появление новой модели без spam'а в Loki.
var (
	unknownModelCostMu   sync.Mutex
	unknownModelCostSeen = map[string]struct{}{}
)

func incUnknownModelCost(model string) {
	unknownModelCostMu.Lock()
	_, seen := unknownModelCostSeen[model]
	unknownModelCostSeen[model] = struct{}{}
	unknownModelCostMu.Unlock()
	if !seen {
		// observeUnknownModel — Prometheus counter; см. metrics.go
		observeUnknownModel(model)
	}
}
