package billing

import (
	"context"
	"errors"
)

const (
	EntitlementMockInterviewsPerMonth  = "mock_interviews_per_month"
	EntitlementCompanyTemplatesEnabled = "company_templates_enabled"
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
