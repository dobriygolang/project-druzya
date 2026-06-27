package llm

import (
	"context"
	"encoding/json"
	"time"
)

const fakeProvider = "fake"
const fakeModel = "fake-evaluator-v1"

// FakeClient returns deterministic valid JSON for dev/tests.
type FakeClient struct{}

// NewFakeClient constructs a fake LLM client.
func NewFakeClient() *FakeClient {
	return &FakeClient{}
}

func (c *FakeClient) Evaluate(_ context.Context, req EvaluateRequest) (EvaluateResponse, error) {
	payload := map[string]any{
		"score":        78.0,
		"passed":       true,
		"summary":      "Solid answer with room for minor improvements.",
		"strengths":    []string{"Clear structure", "Covers main requirements"},
		"improvements": []string{"Add edge case discussion"},
		"feedback":     map[string]any{"overall": "meets expectations"},
	}
	raw, _ := json.Marshal(payload)
	reqJSON, _ := json.Marshal(map[string]any{
		"system": req.SystemPrompt,
		"user":   req.UserPrompt,
	})
	respJSON, _ := json.Marshal(map[string]any{
		"choices": []map[string]any{{"message": map[string]any{"content": string(raw)}}},
	})
	pt, ct, tt := 100, 200, 300
	cost := 0.0
	return EvaluateResponse{
		Provider:         fakeProvider,
		Model:            fakeModel,
		Content:          string(raw),
		RequestJSON:      reqJSON,
		ResponseJSON:     respJSON,
		PromptTokens:     &pt,
		CompletionTokens: &ct,
		TotalTokens:      &tt,
		CostUSD:          &cost,
		LatencyMS:        int(time.Millisecond),
	}, nil
}
