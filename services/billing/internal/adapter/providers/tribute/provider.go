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
// Accepts our normalized contract and common Tribute field aliases.
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
	ID             string          `json:"id"`
	EventType      string          `json:"event_type"`
	Event          string          `json:"event"`
	Name           string          `json:"name"`
	TelegramUserID int64           `json:"telegram_user_id"`
	TelegramID     int64           `json:"telegram_id"`
	Username       string          `json:"username"`
	SubscriptionID string          `json:"subscription_id"`
	PaymentID      string          `json:"payment_id"`
	Tier           string          `json:"tier"`
	ProductID      string          `json:"product_id"`
	Amount         string          `json:"amount"`
	Currency       string          `json:"currency"`
	Status         string          `json:"status"`
	PeriodStart    *time.Time      `json:"period_start"`
	PeriodEnd      *time.Time      `json:"period_end"`
	User           *webhookUser    `json:"user"`
	Data           json.RawMessage `json:"data"`
	Raw            json.RawMessage `json:"-"`
}

type webhookUser struct {
	TelegramID int64  `json:"telegram_id"`
	Username   string `json:"username"`
}

// VerifyWebhook validates shared secret header when configured.
func (p *Provider) VerifyWebhook(_ context.Context, headers map[string]string, _ []byte) error {
	if p.cfg.WebhookSecret == "" {
		return fmt.Errorf("tribute webhook secret not configured: %w", providers.ErrWebhookUnauthorized)
	}
	for _, key := range []string{"X-Tribute-Secret", "X-Webhook-Secret", "X-Api-Key", "Api-Key"} {
		if headers[key] == p.cfg.WebhookSecret {
			return nil
		}
	}
	return fmt.Errorf("invalid tribute webhook secret: %w", providers.ErrWebhookUnauthorized)
}

// ParseWebhook decodes a Tribute webhook body.
func (p *Provider) ParseWebhook(_ context.Context, _ map[string]string, body []byte) (providers.Event, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return providers.Event{}, fmt.Errorf("decode tribute payload: %w", err)
	}
	payload.Raw = append(json.RawMessage(nil), body...)

	eventID := firstNonEmpty(payload.EventID, payload.ID)
	if eventID == "" {
		return providers.Event{}, fmt.Errorf("missing event_id")
	}

	telegramID := payload.TelegramUserID
	if telegramID == 0 {
		telegramID = payload.TelegramID
	}
	if telegramID == 0 && payload.User != nil {
		telegramID = payload.User.TelegramID
	}
	if telegramID == 0 && len(payload.Data) > 0 {
		var nested webhookPayload
		if err := json.Unmarshal(payload.Data, &nested); err == nil {
			telegramID = nested.TelegramUserID
			if telegramID == 0 {
				telegramID = nested.TelegramID
			}
			if nested.Tier != "" && payload.Tier == "" {
				payload.Tier = nested.Tier
			}
			if nested.SubscriptionID != "" && payload.SubscriptionID == "" {
				payload.SubscriptionID = nested.SubscriptionID
			}
		}
	}
	if telegramID == 0 {
		return providers.Event{}, fmt.Errorf("missing telegram_user_id")
	}

	eventType := normalizeEventType(firstNonEmpty(payload.EventType, payload.Event, payload.Name))
	if eventType == "" {
		return providers.Event{}, fmt.Errorf("unsupported event_type %q", payload.EventType)
	}

	username := firstNonEmpty(payload.Username, userName(payload.User))
	tier := firstNonEmpty(payload.Tier, payload.ProductID)

	return providers.Event{
		Provider:               p.ProviderName(),
		EventType:              eventType,
		ProviderEventID:        eventID,
		ProviderUserID:         fmt.Sprintf("%d", telegramID),
		ProviderUsername:       username,
		ProviderSubscriptionID: payload.SubscriptionID,
		ProviderPaymentID:      payload.PaymentID,
		Tier:                   tier,
		Amount:                 payload.Amount,
		Currency:               payload.Currency,
		Status:                 payload.Status,
		CurrentPeriodStart:     payload.PeriodStart,
		CurrentPeriodEnd:       payload.PeriodEnd,
		RawPayload:             payload.Raw,
	}, nil
}

func userName(u *webhookUser) string {
	if u == nil {
		return ""
	}
	return u.Username
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func normalizeEventType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case providers.EventSubscriptionCreated, "subscription.created", "new_subscription":
		return providers.EventSubscriptionCreated
	case providers.EventSubscriptionRenewed, "subscription.renewed", "renewed":
		return providers.EventSubscriptionRenewed
	case providers.EventSubscriptionCancelled, "subscription.canceled", "subscription.cancelled", "cancelled", "canceled":
		return providers.EventSubscriptionCancelled
	case providers.EventSubscriptionExpired, "subscription.expired", "expired":
		return providers.EventSubscriptionExpired
	case providers.EventPaymentSucceeded, "payment.succeeded", "payment_success":
		return providers.EventPaymentSucceeded
	case providers.EventPaymentFailed, "payment.failed":
		return providers.EventPaymentFailed
	default:
		return ""
	}
}
