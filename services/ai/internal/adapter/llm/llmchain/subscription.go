package llmchain

// SubscriptionPlan gates paid virtual models. Interview evaluation uses free tier only.
type SubscriptionPlan string

const (
	SubscriptionPlanFree SubscriptionPlan = "free"
	SubscriptionPlanPro  SubscriptionPlan = "pro"
	SubscriptionPlanMax  SubscriptionPlan = "max"
)

func (p SubscriptionPlan) String() string { return string(p) }
