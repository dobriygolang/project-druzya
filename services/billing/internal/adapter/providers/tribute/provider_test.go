package tribute_test

import (
	"context"
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
