package tribute

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
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

type webhookEnvelope struct {
	Name      string          `json:"name"`
	SentAt    string          `json:"sent_at"`
	CreatedAt string          `json:"created_at"`
	EventID   string          `json:"event_id"`
	Payload   json.RawMessage `json:"payload"`
}

type webhookPayload struct {
	EventID          string          `json:"event_id"`
	ID               string          `json:"id"`
	EventType        string          `json:"event_type"`
	Event            string          `json:"event"`
	Name             string          `json:"name"`
	TelegramUserID   int64           `json:"telegram_user_id"`
	TelegramID       int64           `json:"telegram_id"`
	Username         string          `json:"username"`
	SubscriptionID   json.RawMessage `json:"subscription_id"`
	PaymentID        string          `json:"payment_id"`
	Tier             string          `json:"tier"`
	ProductID        json.RawMessage `json:"product_id"`
	Amount           string          `json:"amount"`
	Currency         string          `json:"currency"`
	Status           string          `json:"status"`
	PeriodStart      *time.Time      `json:"period_start"`
	PeriodEnd        *time.Time      `json:"period_end"`
	User             *webhookUser    `json:"user"`
	Data             json.RawMessage `json:"data"`
	Raw              json.RawMessage `json:"-"`
	envelopeName     string
	envelopeSentAt   string
	envelopeEventID  string
}

type webhookUser struct {
	TelegramID int64  `json:"telegram_id"`
	Username   string `json:"username"`
}

// VerifyWebhook validates Tribute trbt-signature (HMAC-SHA256 hex of raw body) or legacy secret headers.
func (p *Provider) VerifyWebhook(_ context.Context, headers map[string]string, body []byte) error {
	if p.cfg.WebhookSecret == "" {
		return fmt.Errorf("tribute webhook secret not configured: %w", providers.ErrWebhookUnauthorized)
	}
	if sig := headerValue(headers, "trbt-signature"); sig != "" {
		if verifyTRBTSignature(p.cfg.WebhookSecret, body, sig) {
			return nil
		}
		return fmt.Errorf("invalid tribute webhook signature: %w", providers.ErrWebhookUnauthorized)
	}
	for _, key := range []string{"X-Tribute-Secret", "X-Webhook-Secret", "X-Api-Key", "Api-Key"} {
		if headerValue(headers, key) == p.cfg.WebhookSecret {
			return nil
		}
	}
	return fmt.Errorf("invalid tribute webhook secret: %w", providers.ErrWebhookUnauthorized)
}

// ParseWebhook decodes a Tribute webhook body.
func (p *Provider) ParseWebhook(_ context.Context, _ map[string]string, body []byte) (providers.Event, error) {
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" || trimmed == "{}" {
		return providers.Event{}, providers.ErrWebhookPing
	}

	payload, err := decodeWebhookPayload(body)
	if err != nil {
		return providers.Event{}, err
	}
	payload.Raw = append(json.RawMessage(nil), body...)

	rawEventType := firstNonEmpty(payload.EventType, payload.Event, payload.Name, payload.envelopeName)
	if isTributeTestEvent(rawEventType) {
		return providers.Event{}, providers.ErrWebhookPing
	}

	eventID := firstNonEmpty(payload.EventID, payload.ID, payload.envelopeEventID)
	if eventID == "" && payload.envelopeName != "" && payload.envelopeSentAt != "" {
		eventID = payload.envelopeName + ":" + payload.envelopeSentAt
	}
	if eventID == "" {
		return providers.Event{}, providers.ErrWebhookPing
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
			if len(nested.SubscriptionID) > 0 && len(payload.SubscriptionID) == 0 {
				payload.SubscriptionID = nested.SubscriptionID
			}
		}
	}
	if telegramID == 0 {
		if len(payload.SubscriptionID) == 0 && payload.Tier == "" && len(payload.ProductID) == 0 {
			return providers.Event{}, providers.ErrWebhookPing
		}
		return providers.Event{}, fmt.Errorf("missing telegram_user_id")
	}

	eventType := normalizeEventType(rawEventType)
	if eventType == "" {
		return providers.Event{}, fmt.Errorf("unsupported event_type %q", rawEventType)
	}

	username := firstNonEmpty(payload.Username, userName(payload.User))
	subscriptionID := rawJSONID(payload.SubscriptionID)
	tier := firstNonEmpty(payload.Tier, rawJSONID(payload.ProductID), subscriptionID)

	return providers.Event{
		Provider:               p.ProviderName(),
		EventType:              eventType,
		ProviderEventID:        eventID,
		ProviderUserID:         fmt.Sprintf("%d", telegramID),
		ProviderUsername:       username,
		ProviderSubscriptionID: subscriptionID,
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

func decodeWebhookPayload(body []byte) (webhookPayload, error) {
	var envelope webhookEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return webhookPayload{}, fmt.Errorf("decode tribute payload: %w", err)
	}
	if len(envelope.Payload) > 0 {
		var payload webhookPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return webhookPayload{}, fmt.Errorf("decode tribute payload: %w", err)
		}
		if payload.Name == "" {
			payload.Name = envelope.Name
		}
		payload.envelopeName = envelope.Name
		payload.envelopeSentAt = envelope.SentAt
		payload.envelopeEventID = envelope.EventID
		return payload, nil
	}
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return webhookPayload{}, fmt.Errorf("decode tribute payload: %w", err)
	}
	return payload, nil
}

func verifyTRBTSignature(secret string, body []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	got := strings.TrimSpace(signature)
	if len(expected) != len(got) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(got)) == 1
}

func headerValue(headers map[string]string, name string) string {
	for k, v := range headers {
		if strings.EqualFold(k, name) {
			return v
		}
	}
	return ""
}

func isTributeTestEvent(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "test", "test_webhook", "ping", "webhook_test":
		return true
	default:
		return false
	}
}

func rawJSONID(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return strings.TrimSpace(s)
	}
	var n int64
	if err := json.Unmarshal(raw, &n); err == nil {
		return strconv.FormatInt(n, 10)
	}
	return strings.TrimSpace(string(raw))
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
	case providers.EventSubscriptionCreated, "subscription.created", "new_subscription", "newsubscription":
		return providers.EventSubscriptionCreated
	case providers.EventSubscriptionRenewed, "subscription.renewed", "renewed", "renewed_subscription", "renewedsubscription":
		return providers.EventSubscriptionRenewed
	case providers.EventSubscriptionCancelled, "subscription.canceled", "subscription.cancelled", "cancelled", "canceled", "cancelled_subscription", "cancelledsubscription":
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
