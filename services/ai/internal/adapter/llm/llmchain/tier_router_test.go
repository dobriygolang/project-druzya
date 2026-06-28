package llmchain_test

import (
	"context"
	"testing"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

type stubClient struct {
	name string
}

func (s *stubClient) Chat(_ context.Context, req llmchain.Request) (llmchain.Response, error) {
	return llmchain.Response{Content: s.name + ":" + string(req.UserTier)}, nil
}

func (s *stubClient) ChatStream(_ context.Context, _ llmchain.Request) (<-chan llmchain.StreamEvent, error) {
	ch := make(chan llmchain.StreamEvent)
	close(ch)
	return ch, nil
}

func TestTierRouter_Chat(t *testing.T) {
	t.Parallel()
	free := &stubClient{name: "free"}
	pro := &stubClient{name: "pro"}
	router := llmchain.NewTierRouter(free, pro, nil, nil)

	resp, err := router.Chat(context.Background(), llmchain.Request{UserTier: llmchain.SubscriptionPlanFree})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Content != "free:free" {
		t.Fatalf("free tier: got %q", resp.Content)
	}

	resp, err = router.Chat(context.Background(), llmchain.Request{UserTier: llmchain.SubscriptionPlanPro})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Content != "pro:pro" {
		t.Fatalf("pro tier: got %q", resp.Content)
	}
}
