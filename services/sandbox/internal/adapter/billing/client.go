package billing

import (
	"context"
	"errors"
)

const (
	EntitlementCodeRunsPerDay = "code_runs_per_day"
)

var (
	ErrQuotaExceeded   = errors.New("quota exceeded")
	ErrFeatureDisabled = errors.New("feature disabled")
)

// Client checks entitlements and usage with billing-service.
type Client interface {
	CheckEntitlement(ctx context.Context, userID, key string) error
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error
}
