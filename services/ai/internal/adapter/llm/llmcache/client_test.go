package llmcache

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

type countingClient struct {
	calls atomic.Int32
}

func (c *countingClient) Chat(_ context.Context, _ llmchain.Request) (llmchain.Response, error) {
	c.calls.Add(1)
	return llmchain.Response{
		Content:   `{"score":80}`,
		TokensIn:  100,
		TokensOut: 20,
		Provider:  llmchain.ProviderGroq,
		Model:     "test-model",
	}, nil
}

func (c *countingClient) ChatStream(_ context.Context, _ llmchain.Request) (<-chan llmchain.StreamEvent, error) {
	ch := make(chan llmchain.StreamEvent)
	close(ch)
	return ch, nil
}

func TestClientCachesExactPrompt(t *testing.T) {
	t.Parallel()
	inner := &countingClient{}
	cached := NewClient(inner, Options{Enabled: true, MaxEntries: 10})
	req := llmchain.Request{
		Task: llmchain.TaskReasoning,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleUser, Content: "hello"},
		},
	}

	resp1, err := cached.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("first chat: %v", err)
	}
	resp2, err := cached.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("second chat: %v", err)
	}
	if inner.calls.Load() != 1 {
		t.Fatalf("expected 1 upstream call, got %d", inner.calls.Load())
	}
	if !resp2.FromCache {
		t.Fatal("expected cache hit on second call")
	}
	if resp1.Content != resp2.Content {
		t.Fatal("cached content mismatch")
	}
}
