package llmchain

// SubscriptionPlan gates paid virtual models and pinned model ids.
// Mirrors billing plans: free + pro_monthly (mapped to "pro" at call sites).
type SubscriptionPlan string

const (
	SubscriptionPlanFree SubscriptionPlan = "free"
	SubscriptionPlanPro  SubscriptionPlan = "pro"
)

// SubscriptionPlanFromBilling maps billing plan_slug to LLM user tier.
func SubscriptionPlanFromBilling(planSlug string) SubscriptionPlan {
	return SubscriptionPlanFromSlug(planSlug)
}

// SubscriptionPlanFromSlug maps billing plan_slug to llmchain tier.
func SubscriptionPlanFromSlug(planSlug string) SubscriptionPlan {
	switch planSlug {
	case "pro_monthly", "pro", "max":
		return SubscriptionPlanPro
	default:
		return SubscriptionPlanFree
	}
}
