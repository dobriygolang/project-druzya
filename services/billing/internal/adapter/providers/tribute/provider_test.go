package tribute_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers/tribute"
)

func TestParseWebhookNormalizesEvent(t *testing.T) {
	t.Parallel()
	p := tribute.New(tribute.Config{WebhookSecret: "secret"})
	body := []byte(`{
		"event_id":"evt-1",
		"event_type":"subscription_created",
		"telegram_user_id":4242,
		"username":"dev",
		"subscription_id":"sub-1",
		"tier":"tribute_pro_monthly",
		"status":"active"
	}`)
	event, err := p.ParseWebhook(context.Background(), nil, body)
	if err != nil {
		t.Fatal(err)
	}
	if event.Provider != "tribute" || event.EventType != providers.EventSubscriptionCreated {
		t.Fatalf("unexpected event: %+v", event)
	}
	if event.ProviderUserID != "4242" {
		t.Fatalf("expected telegram id string, got %q", event.ProviderUserID)
	}
}

func TestVerifyWebhookSecret(t *testing.T) {
	t.Parallel()
	p := tribute.New(tribute.Config{WebhookSecret: "secret"})
	err := p.VerifyWebhook(context.Background(), map[string]string{"X-Tribute-Secret": "secret"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := p.VerifyWebhook(context.Background(), map[string]string{"X-Tribute-Secret": "wrong"}, nil); err == nil {
		t.Fatal("expected invalid secret error")
	}
}

func TestVerifyWebhookTRBTSignature(t *testing.T) {
	t.Parallel()
	secret := "6ada5ab0-3ab9-4682-b4bb-d2442add"
	body := []byte(`{"name":"new_subscription","sent_at":"2026-06-29T11:00:00Z","payload":{"telegram_user_id":1,"subscription_id":99}}`)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))

	p := tribute.New(tribute.Config{WebhookSecret: secret})
	if err := p.VerifyWebhook(context.Background(), map[string]string{"trbt-signature": sig}, body); err != nil {
		t.Fatal(err)
	}
	if err := p.VerifyWebhook(context.Background(), map[string]string{"trbt-signature": "bad"}, body); err == nil {
		t.Fatal("expected invalid signature error")
	}
}

func TestParseWebhookTributeEnvelope(t *testing.T) {
	t.Parallel()
	p := tribute.New(tribute.Config{WebhookSecret: "secret"})
	body := []byte(`{
		"name":"new_subscription",
		"sent_at":"2026-06-29T11:00:00Z",
		"payload":{
			"telegram_user_id":4242,
			"username":"dev",
			"subscription_id":12345,
			"status":"active"
		}
	}`)
	event, err := p.ParseWebhook(context.Background(), nil, body)
	if err != nil {
		t.Fatal(err)
	}
	if event.EventType != providers.EventSubscriptionCreated {
		t.Fatalf("unexpected event type: %q", event.EventType)
	}
	if event.ProviderUserID != "4242" || event.Tier != "12345" {
		t.Fatalf("unexpected event: %+v", event)
	}
}

func TestVerifyWebhookRejectsWhenSecretNotConfigured(t *testing.T) {
	t.Parallel()
	p := tribute.New(tribute.Config{})
	err := p.VerifyWebhook(context.Background(), map[string]string{"X-Tribute-Secret": "any"}, nil)
	if err == nil {
		t.Fatal("expected error when webhook secret is not configured")
	}
}
