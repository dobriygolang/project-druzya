package billing

import (
	"context"
	"errors"
)

const (
	EntitlementMockInterviewsPerMonth  = "mock_interviews_per_month"
	EntitlementCompanyTemplatesEnabled = "company_templates_enabled"
	EntitlementSDAITurnsPerMonth       = "sd_ai_turns_per_month"
)

var (
	ErrQuotaExceeded   = errors.New("quota exceeded")
	ErrFeatureDisabled = errors.New("feature disabled")
)

// Client checks entitlements and usage with billing-service.
type Client interface {
	CheckEntitlement(ctx context.Context, userID, key string) error
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error
	ReleaseUsage(ctx context.Context, userID, key, idempotencyKey string, amount int) error
}
