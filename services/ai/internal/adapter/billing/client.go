package billing

import (
	"context"
	"errors"
)

const (
	MetricLLMEvaluation            = "ai_evaluations_per_day"
	EntitlementAIEvaluationsPerDay = "ai_evaluations_per_day"
)

// ErrQuotaExceeded means the user hit their plan limit.
var ErrQuotaExceeded = errors.New("quota exceeded")

// Client checks and records billable usage.
type Client interface {
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error
	ReleaseUsage(ctx context.Context, userID, key, idempotencyKey string, amount int) error
}
