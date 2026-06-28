package llmchain

// SubscriptionPlan gates paid virtual models and pinned model ids.
// Mirrors billing plans: free + pro_monthly (mapped to "pro" at call sites).
type SubscriptionPlan string

const (
	SubscriptionPlanFree SubscriptionPlan = "free"
	SubscriptionPlanPro  SubscriptionPlan = "pro"
)

func (p SubscriptionPlan) String() string { return string(p) }
