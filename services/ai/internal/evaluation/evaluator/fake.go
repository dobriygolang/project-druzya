package evaluator

import (
	"context"
	"encoding/json"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

// FakeClient returns a deterministic passing score without LLM calls.
type FakeClient struct{}

func NewFakeClient() Client { return &FakeClient{} }

func (f *FakeClient) Evaluate(_ context.Context, _ Input) (*Output, error) {
	passed := true
	content, _ := json.Marshal(map[string]any{
		"score":        75,
		"passed":       true,
		"summary":      "Acceptable answer (fake evaluator).",
		"strengths":    []string{"clear structure"},
		"improvements": []string{"add edge cases"},
	})
	return &Output{
		Result: &evaluationmodel.EvaluationResult{
			Score:        75,
			Passed:       &passed,
			Summary:      "Acceptable answer (fake evaluator).",
			Strengths:    []string{"clear structure"},
			Improvements: []string{"add edge cases"},
		},
		Calls: []CallRecord{{
			Provider:     "fake",
			Model:        "fake",
			RequestJSON:  []byte(`{}`),
			ResponseJSON: content,
			ParsedResult: content,
			LatencyMS:    1,
		}},
	}, nil
}
