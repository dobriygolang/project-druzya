package billing

import (
	"context"
	"errors"
)

const EntitlementLiveRoomsPerMonth = "live_rooms_per_month"

var (
	ErrQuotaExceeded   = errors.New("quota exceeded")
	ErrFeatureDisabled = errors.New("feature disabled")
)

type Client interface {
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error
}

type noopClient struct{}

func (noopClient) CheckAndConsumeUsage(context.Context, string, string, int) error {
	return nil
}

// Noop returns a client that skips billing checks (local dev without billing).
func Noop() Client { return noopClient{} }
