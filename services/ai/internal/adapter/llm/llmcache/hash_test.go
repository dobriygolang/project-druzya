package llmcache

import (
	"testing"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

func TestHashRequestStable(t *testing.T) {
	t.Parallel()
	req := llmchain.Request{
		Task:        llmchain.TaskReasoning,
		UserTier:    llmchain.SubscriptionPlanFree,
		Temperature: 0,
		MaxTokens:   200,
		JSONMode:    true,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleSystem, Content: "system"},
			{Role: llmchain.RoleUser, Content: "user"},
		},
	}
	a := HashRequest(req)
	b := HashRequest(req)
	if a != b || a == "" {
		t.Fatalf("hash not stable: %q %q", a, b)
	}
}

func TestHashRequestDiffersOnContent(t *testing.T) {
	t.Parallel()
	base := llmchain.Request{
		Task: llmchain.TaskCodeReview,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleUser, Content: "a"},
		},
	}
	other := llmchain.Request{
		Task: llmchain.TaskCodeReview,
		Messages: []llmchain.Message{
			{Role: llmchain.RoleUser, Content: "b"},
		},
	}
	if HashRequest(base) == HashRequest(other) {
		t.Fatal("expected different hashes for different prompts")
	}
}
