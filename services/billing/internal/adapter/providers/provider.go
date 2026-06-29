package providers

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

// ErrWebhookUnauthorized indicates webhook verification failed (bad/missing secret).
var ErrWebhookUnauthorized = errors.New("webhook verification failed")

// ErrWebhookPing indicates an authenticated connectivity/test payload with no billable event.
var ErrWebhookPing = errors.New("webhook ping")

// Event is a provider-normalized billing event.
type Event struct {
	Provider               string
	EventType              string
	ProviderEventID        string
	ProviderUserID         string
	ProviderUsername       string
	ProviderSubscriptionID string
	ProviderPaymentID      string
	Tier                   string
	Amount                 string
	Currency               string
	Status                 string
	CurrentPeriodStart     *time.Time
	CurrentPeriodEnd       *time.Time
	RawPayload             json.RawMessage
}

const (
	EventSubscriptionCreated   = "subscription_created"
	EventSubscriptionRenewed   = "subscription_renewed"
	EventSubscriptionCancelled = "subscription_cancelled"
	EventSubscriptionExpired   = "subscription_expired"
	EventPaymentSucceeded      = "payment_succeeded"
	EventPaymentFailed         = "payment_failed"
)

// BillingProvider normalizes external payment provider payloads.
type BillingProvider interface {
	ProviderName() string
	VerifyWebhook(ctx context.Context, headers map[string]string, body []byte) error
	ParseWebhook(ctx context.Context, headers map[string]string, body []byte) (Event, error)
}
