package billing

import (
	"context"
	"errors"
)

const (
	MetricLLMEvaluation            = "ai_evaluations_per_day"
	EntitlementAIEvaluationsPerDay = "ai_evaluations_per_day"

	PlanFree       = "free"
	PlanProMonthly = "pro_monthly"
)

// ErrQuotaExceeded means the user hit their plan limit.
var ErrQuotaExceeded = errors.New("quota exceeded")

// Entitlements is a minimal billing view for routing and UX.
type Entitlements struct {
	PlanSlug string
	PlanName string
}

// Client checks and records billable usage.
type Client interface {
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error
	ReleaseUsage(ctx context.Context, userID, key, idempotencyKey string, amount int) error
	GetEntitlements(ctx context.Context, userID string) (*Entitlements, error)
}

// IsProPlan reports whether slug is a paid plan.
func IsProPlan(planSlug string) bool {
	switch planSlug {
	case PlanProMonthly, "pro":
		return true
	default:
		return false
	}
}
