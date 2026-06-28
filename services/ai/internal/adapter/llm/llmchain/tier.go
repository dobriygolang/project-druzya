package llmchain

import (
	"errors"
	"slices"
	"strings"
)

// ErrTierRequired возвращается candidates() когда запрошенная модель
// (через ModelOverride) или virtual chain требует tier выше, чем у
// пользователя. Handler-слой мэппит в Connect CodeResourceExhausted →
// HTTP 402 с полем upgrade_url (или 403, если UX диктует иначе).
var ErrTierRequired = errors.New("llmchain: subscription tier required")

// ModelRequiredTier — per-модельный paywall. Любая модель НЕ в карте
// считается free-доступной. Все paid OpenRouter / DeepSeek ids — pro.
var ModelRequiredTier = map[string]SubscriptionPlan{
	"openai/gpt-4.1-mini":        SubscriptionPlanPro,
	"openai/o3-mini":             SubscriptionPlanPro,
	"anthropic/claude-haiku-4.5": SubscriptionPlanPro,
	"openai/gpt-4.1":              SubscriptionPlanPro,
	"openai/gpt-4o":               SubscriptionPlanPro,
	"openai/o3":                   SubscriptionPlanPro,
	"anthropic/claude-sonnet-4.5": SubscriptionPlanPro,
	"anthropic/claude-opus-4":     SubscriptionPlanPro,
	"deepseek-chat":               SubscriptionPlanPro,
	"deepseek-reasoner":           SubscriptionPlanPro,
}

// ModelRequiresTier — lookup с default free. Удобно для вызова без !ok.
func ModelRequiresTier(modelID string) SubscriptionPlan {
	if t, ok := ModelRequiredTier[modelID]; ok {
		return t
	}
	return SubscriptionPlanFree
}

// tierRank: 0=free, 1=pro. Legacy "max" трактуем как pro.
func tierRank(t SubscriptionPlan) int {
	switch t {
	case SubscriptionPlanPro, SubscriptionPlan("max"):
		return 1
	default:
		return 0
	}
}

// TierCovers — true если userTier покрывает required. Пустой userTier → free.
func TierCovers(userTier, required SubscriptionPlan) bool {
	return tierRank(userTier) >= tierRank(required)
}

// ───────────────────────────────────────────────────────────────────────
// Virtual models — druz9/turbo (free) и druz9/pro (paid).
// Billing знает только free + pro_monthly; chain принимает ModelOverride
// и разворачивает fallback-цепочку реальных model id.
// ───────────────────────────────────────────────────────────────────────

const (
	// VirtualTurbo — free-chain (дублирует DefaultTaskModelMap для override).
	VirtualTurbo = "druz9/turbo"
	// VirtualPro — pro subscription: cheap paid + reasoning + premium fallback.
	VirtualPro = "druz9/pro"

	// Legacy virtual ids (removed); ResolveVirtualModelID maps them to VirtualPro.
	legacyVirtualUltra     = "druz9/ultra"
	legacyVirtualReasoning = "druz9/reasoning"
)

// VirtualCandidate — одно звено фиктивного chain'а.
type VirtualCandidate struct {
	Provider Provider
	Model    string
}

// virtualChains — цепочки моделей per virtual id. Порядок = приоритет попыток.
var virtualChains = map[string][]VirtualCandidate{
	VirtualTurbo: {
		{Provider: ProviderGroq, Model: "llama-3.3-70b-versatile"},
		{Provider: ProviderCerebras, Model: "zai-glm-4.7"},
		{Provider: ProviderMistral, Model: "mistral-small-latest"},
		{Provider: ProviderOpenRouter, Model: "qwen/qwen3-coder:free"},
	},
	VirtualPro: {
		// Cheap pro lane
		{Provider: ProviderOpenRouter, Model: "openai/gpt-4.1-mini"},
		{Provider: ProviderOpenRouter, Model: "anthropic/claude-haiku-4.5"},
		{Provider: ProviderDeepSeek, Model: "deepseek-chat"},
		// Reasoning (бывш. druz9/reasoning)
		{Provider: ProviderDeepSeek, Model: "deepseek-reasoner"},
		{Provider: ProviderOpenRouter, Model: "openai/o3-mini"},
		// Premium (бывш. druz9/ultra)
		{Provider: ProviderOpenRouter, Model: "anthropic/claude-sonnet-4.5"},
		{Provider: ProviderOpenRouter, Model: "openai/gpt-4.1"},
		{Provider: ProviderOpenRouter, Model: "openai/gpt-4o"},
		// Degraded → free chain
		{Provider: ProviderGroq, Model: "llama-3.3-70b-versatile"},
		{Provider: ProviderCerebras, Model: "zai-glm-4.7"},
	},
}

// DefaultVirtualChains возвращает копию hardcoded virtualChains для admin UI.
func DefaultVirtualChains() map[string][]VirtualCandidate {
	out := make(map[string][]VirtualCandidate, len(virtualChains))
	for k, v := range virtualChains {
		out[k] = slices.Clone(v)
	}
	return out
}

// VirtualModelMinTier — минимальный tier для использования виртуалки.
var VirtualModelMinTier = map[string]SubscriptionPlan{
	VirtualTurbo: SubscriptionPlanFree,
	VirtualPro:   SubscriptionPlanPro,
}

// ResolveVirtualModelID нормализует legacy druz9/ultra|reasoning → druz9/pro.
func ResolveVirtualModelID(modelID string) string {
	switch modelID {
	case legacyVirtualUltra, legacyVirtualReasoning:
		return VirtualPro
	default:
		return modelID
	}
}

// IsVirtualModel — druz9/* prefix (включая legacy ids).
func IsVirtualModel(modelID string) bool {
	return strings.HasPrefix(modelID, "druz9/")
}
