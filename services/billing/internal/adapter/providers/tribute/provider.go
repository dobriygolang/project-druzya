package tribute

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers"
)

// Config holds Tribute webhook settings.
type Config struct {
	WebhookSecret string
}

// Provider parses Tribute webhook payloads.
// Payload format is a project-defined normalization contract until Tribute API is finalized.
type Provider struct {
	cfg Config
}

// New constructs a Tribute provider adapter.
func New(cfg Config) *Provider {
	return &Provider{cfg: cfg}
}

func (p *Provider) ProviderName() string { return "tribute" }

type webhookPayload struct {
	EventID        string          `json:"event_id"`
	EventType      string          `json:"event_type"`
	TelegramUserID int64           `json:"telegram_user_id"`
	Username       string          `json:"username"`
	SubscriptionID string          `json:"subscription_id"`
	PaymentID      string          `json:"payment_id"`
	Tier           string          `json:"tier"`
	Amount         string          `json:"amount"`
	Currency       string          `json:"currency"`
	Status         string          `json:"status"`
	PeriodStart    *time.Time      `json:"period_start"`
	PeriodEnd      *time.Time      `json:"period_end"`
	Raw            json.RawMessage `json:"-"`
}

// VerifyWebhook validates shared secret header when configured.
func (p *Provider) VerifyWebhook(_ context.Context, headers map[string]string, _ []byte) error {
	if p.cfg.WebhookSecret == "" {
		return fmt.Errorf("tribute webhook secret not configured: %w", providers.ErrWebhookUnauthorized)
	}
	for _, key := range []string{"X-Tribute-Secret", "X-Webhook-Secret"} {
		if headers[key] == p.cfg.WebhookSecret {
			return nil
		}
	}
	return fmt.Errorf("invalid tribute webhook secret: %w", providers.ErrWebhookUnauthorized)
}

// ParseWebhook decodes a normalized Tribute payload.
func (p *Provider) ParseWebhook(_ context.Context, _ map[string]string, body []byte) (providers.Event, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return providers.Event{}, fmt.Errorf("decode tribute payload: %w", err)
	}
	payload.Raw = append(json.RawMessage(nil), body...)

	if payload.EventID == "" {
		return providers.Event{}, fmt.Errorf("missing event_id")
	}
	if payload.TelegramUserID == 0 {
		return providers.Event{}, fmt.Errorf("missing telegram_user_id")
	}
	eventType := normalizeEventType(payload.EventType)
	if eventType == "" {
		return providers.Event{}, fmt.Errorf("unsupported event_type %q", payload.EventType)
	}

	return providers.Event{
		Provider:               p.ProviderName(),
		EventType:              eventType,
		ProviderEventID:        payload.EventID,
		ProviderUserID:         fmt.Sprintf("%d", payload.TelegramUserID),
		ProviderUsername:       payload.Username,
		ProviderSubscriptionID: payload.SubscriptionID,
		ProviderPaymentID:      payload.PaymentID,
		Tier:                   payload.Tier,
		Amount:                 payload.Amount,
		Currency:               payload.Currency,
		Status:                 payload.Status,
		CurrentPeriodStart:     payload.PeriodStart,
		CurrentPeriodEnd:       payload.PeriodEnd,
		RawPayload:             payload.Raw,
	}, nil
}

func normalizeEventType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case providers.EventSubscriptionCreated, "subscription.created":
		return providers.EventSubscriptionCreated
	case providers.EventSubscriptionRenewed, "subscription.renewed":
		return providers.EventSubscriptionRenewed
	case providers.EventSubscriptionCancelled, "subscription.cancelled", "subscription.canceled":
		return providers.EventSubscriptionCancelled
	case providers.EventSubscriptionExpired, "subscription.expired":
		return providers.EventSubscriptionExpired
	case providers.EventPaymentSucceeded, "payment.succeeded":
		return providers.EventPaymentSucceeded
	case providers.EventPaymentFailed, "payment.failed":
		return providers.EventPaymentFailed
	default:
		return ""
	}
}
