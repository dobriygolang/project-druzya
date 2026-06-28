package llmchain

import (
	"errors"
	"slices"
	"strings"
)

// ErrTierRequired возвращается candidates() когда запрошенная модель
// (через ModelOverride) или virtual chain требует tier выше, чем у
// пользователя. Handler-слой мэппит в Connect CodeResourceExhausted →
// HTTP 402 с полем upgrade_url (или 403, если UX дикcrет иначе).
var ErrTierRequired = errors.New("llmchain: subscription tier required")

// ModelRequiredTier — per-модельный paywall. Любая модель НЕ в карте
// считается free-доступной. Добавление нового paid-tier'а = одна строка
// здесь.
var ModelRequiredTier = map[string]SubscriptionPlan{
	// OpenRouter paid-lane (bypass :free suffix) — cheap, general purpose.
	"openai/gpt-4.1-mini":        SubscriptionPlanPro,
	"openai/o3-mini":             SubscriptionPlanPro,
	"anthropic/claude-haiku-4.5": SubscriptionPlanPro,
	// OpenRouter premium.
	"openai/gpt-4.1":              SubscriptionPlanMax,
	"openai/gpt-4o":               SubscriptionPlanMax,
	"openai/o3":                   SubscriptionPlanMax,
	"anthropic/claude-sonnet-4.5": SubscriptionPlanMax,
	"anthropic/claude-opus-4":     SubscriptionPlanMax,
	// DeepSeek direct (самые дёшево-интеллектуальные paid-модели).
	"deepseek-chat":     SubscriptionPlanPro,
	"deepseek-reasoner": SubscriptionPlanPro,
}

// ModelRequiresTier — lookup с default TierFree. Удобно для вызова в
// условиях без обработки !ok.
func ModelRequiresTier(modelID string) SubscriptionPlan {
	if t, ok := ModelRequiredTier[modelID]; ok {
		return t
	}
	return SubscriptionPlanFree
}

// tierRank для сравнения tier'ов. 0=free, 1=pro, 2=max. Синхронизирована
// с subscription/domain.TierRank (копия — кросс-доменный import был бы
// циклом через shared).
func tierRank(t SubscriptionPlan) int {
	switch t {
	case SubscriptionPlanFree:
		return 0
	case SubscriptionPlanPro:
		return 1
	case SubscriptionPlanMax:
		return 2
	}
	return 0
}

// TierCovers — true если userTier покрывает required. Пустой userTier
// трактуется как free (graceful default для legacy-caller'ов).
func TierCovers(userTier, required SubscriptionPlan) bool {
	return tierRank(userTier) >= tierRank(required)
}

// ───────────────────────────────────────────────────────────────────────
// Virtual models — "druz9/pro" / "druz9/ultra" / "druz9/reasoning".
// Юзер в UI выбирает виртуальную модель; chain разворачивает её в
// fallback-chain реальных моделей и пробует последовательно.
// ───────────────────────────────────────────────────────────────────────

const (
	// VirtualTurbo — free-chain (уже реализован через Task-mapping, для
	// консистентности api также принимается как ModelOverride).
	VirtualTurbo = "druz9/turbo"
	// VirtualPro — для tier=pro+. Cheap-paid модели: быстрые, качественные.
	VirtualPro = "druz9/pro"
	// VirtualUltra — для tier=max. Top-tier модели.
	VirtualUltra = "druz9/ultra"
	// VirtualReasoning — для tier=pro+. Reasoning-heavy (R1, o3).
	VirtualReasoning = "druz9/reasoning"
)

// VirtualCandidate — одно звено фиктивного chain'а.
type VirtualCandidate struct {
	Provider Provider
	Model    string
}

// virtualChains — цепочки моделей per virtual id. Порядок = приоритет
// попыток (от быстрого/дешёвого к надёжному fallback'у).
//
// Актуальность моделей (2026-Q2) — меняй тут при обновлении pricing/lineup
// у OpenRouter/DeepSeek. Не забудь синхронно обновить ModelRequiredTier
// выше если модель переехала в другой tier.
var virtualChains = map[string][]VirtualCandidate{
	VirtualTurbo: {
		// Дублирует логику task_map для TaskCopilotStream (free-chain),
		// на случай если caller прислал druz9/turbo через ModelOverride.
		{Provider: ProviderGroq, Model: "llama-3.3-70b-versatile"},
		{Provider: ProviderCerebras, Model: "zai-glm-4.7"},
		{Provider: ProviderMistral, Model: "mistral-small-latest"},
		{Provider: ProviderOpenRouter, Model: "qwen/qwen3-coder:free"},
	},
	VirtualPro: {
		// Быстрые+умные pro-tier модели. gpt-4.1-mini — best-in-class
		// для своего прайса, Haiku 4.5 — baseline Anthropic. DeepSeek V3
		// дёшев но slightly slower на OpenRouter — ставим после.
		{Provider: ProviderOpenRouter, Model: "openai/gpt-4.1-mini"},
		{Provider: ProviderOpenRouter, Model: "anthropic/claude-haiku-4.5"},
		{Provider: ProviderDeepSeek, Model: "deepseek-chat"},
		// Fallback в free-chain если все paid провайдеры легли —
		// юзер не остаётся без ответа.
		{Provider: ProviderGroq, Model: "llama-3.3-70b-versatile"},
		{Provider: ProviderCerebras, Model: "zai-glm-4.7"},
	},
	VirtualUltra: {
		// Top-tier. Claude Sonnet 4.5 — гибкий best-all-around; gpt-4.1
		// — конкурент. gpt-4o — backup если кто-то лёг.
		{Provider: ProviderOpenRouter, Model: "anthropic/claude-sonnet-4.5"},
		{Provider: ProviderOpenRouter, Model: "openai/gpt-4.1"},
		{Provider: ProviderOpenRouter, Model: "openai/gpt-4o"},
		// Fallback в pro-level если ultra-модели все задохнулись.
		{Provider: ProviderOpenRouter, Model: "openai/gpt-4.1-mini"},
		// И в free-chain на самый-самый крайний случай.
		{Provider: ProviderGroq, Model: "llama-3.3-70b-versatile"},
	},
	VirtualReasoning: {
		// DeepSeek R1 — лучший price/reasoning на рынке (API).
		// o3-mini — хорош, но Anthropic extended-thinking через sonnet
		// — даёт более связный output на код/архитектуру.
		{Provider: ProviderDeepSeek, Model: "deepseek-reasoner"},
		{Provider: ProviderOpenRouter, Model: "openai/o3-mini"},
		{Provider: ProviderOpenRouter, Model: "anthropic/claude-sonnet-4.5"},
		// Degraded fallback.
		{Provider: ProviderGroq, Model: "llama-3.3-70b-versatile"},
	},
}

// DefaultVirtualChains возвращает копию hardcoded `virtualChains` map'а.
// Admin endpoint раскрывает её фронту чтобы юзер мог видеть/редактировать
// дефолтную цепочку (вместо сообщения «Override отсутствует»). Копия —
// чтобы caller случайно не mutate'нул shared state.
func DefaultVirtualChains() map[string][]VirtualCandidate {
	out := make(map[string][]VirtualCandidate, len(virtualChains))
	for k, v := range virtualChains {
		out[k] = slices.Clone(v)
	}
	return out
}

// VirtualModelMinTier — минимальный tier для использования виртуалки.
// Проверяется ДО expand'а цепочки (чтобы free не увидел внутренние модели).
var VirtualModelMinTier = map[string]SubscriptionPlan{
	VirtualTurbo:     SubscriptionPlanFree,
	VirtualPro:       SubscriptionPlanPro,
	VirtualUltra:     SubscriptionPlanMax,
	VirtualReasoning: SubscriptionPlanPro,
}

// IsVirtualModel — безопасная проверка что это наша виртуалка (а не
// условный "openai/gpt-4o"). Иначе providerFromModelID пошёл бы парсить.
func IsVirtualModel(modelID string) bool {
	return strings.HasPrefix(modelID, "druz9/")
}
