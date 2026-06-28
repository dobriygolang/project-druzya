package billing

import (
	"context"
	"errors"
)

const (
	EntitlementLiveRoomsPerMonth   = "live_rooms_per_month"
	EntitlementLiveRoomsConcurrent = "live_rooms_concurrent"
)

var (
	ErrQuotaExceeded   = errors.New("quota exceeded")
	ErrFeatureDisabled = errors.New("feature disabled")
)

// GaugeLimit is a static ceiling (usage tracked by the owning service).
type GaugeLimit struct {
	Limit     *int
	Unlimited bool
}

type Client interface {
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error
	GetGaugeLimit(ctx context.Context, userID, key string) (GaugeLimit, error)
}

type noopClient struct{}

func (noopClient) CheckAndConsumeUsage(context.Context, string, string, int) error { return nil }

func (noopClient) GetGaugeLimit(context.Context, string, string) (GaugeLimit, error) {
	return GaugeLimit{Unlimited: true}, nil
}

// Noop returns a client that skips billing checks (local dev without billing).
func Noop() Client { return noopClient{} }
