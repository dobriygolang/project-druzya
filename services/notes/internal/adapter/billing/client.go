package billing

import (
	"context"
	"errors"
)

const EntitlementCloudNotesCount = "cloud_notes_count"

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
	GetGaugeLimit(ctx context.Context, userID, key string) (GaugeLimit, error)
}

type noopClient struct{}

func (noopClient) GetGaugeLimit(context.Context, string, string) (GaugeLimit, error) {
	return GaugeLimit{Unlimited: true}, nil
}

// Noop returns a client that skips billing checks (local dev without billing).
func Noop() Client { return noopClient{} }
