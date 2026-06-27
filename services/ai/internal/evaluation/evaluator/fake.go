package evaluator

import (
	"context"
	"encoding/json"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

// FakeClient returns a deterministic passing score without LLM calls.
type FakeClient struct{}

func NewFakeClient() Client { return &FakeClient{} }

func (f *FakeClient) Evaluate(_ context.Context, in Input) (*Output, error) {
	passed := true
	criteria := fakeCriteria(in)
	content, _ := json.Marshal(map[string]any{
		"score":        75,
		"passed":       true,
		"summary":      "Acceptable answer (fake evaluator).",
		"strengths":    []string{"clear structure"},
		"improvements": []string{"add edge cases"},
		"criteria":     criteriaToMaps(in.TaskType, criteria),
	})
	return &Output{
		Result: &evaluationmodel.EvaluationResult{
			Score:        75,
			Passed:       &passed,
			Summary:      "Acceptable answer (fake evaluator).",
			Strengths:    []string{"clear structure"},
			Improvements: []string{"add edge cases"},
		},
		Criteria: criteria,
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

func fakeCriteria(in Input) []CriterionScore {
	if len(in.Criteria) == 0 {
		return []CriterionScore{
			{Key: "overall", Score: 75, MaxScore: 100},
		}
	}
	out := make([]CriterionScore, 0, len(in.Criteria))
	for _, c := range in.Criteria {
		maxScore := float64(c.MaxScore)
		if maxScore <= 0 {
			maxScore = 100
		}
		score := 75.0
		if c.Key == "edge_cases" {
			score = 60
		}
		out = append(out, CriterionScore{Key: c.Key, Score: score, MaxScore: maxScore})
	}
	return out
}

func criteriaToMaps(taskType string, criteria []CriterionScore) []map[string]any {
	out := make([]map[string]any, 0, len(criteria))
	for _, c := range criteria {
		out = append(out, map[string]any{
			"key":       c.Key,
			"score":     c.Score,
			"max_score": c.MaxScore,
			"task_type": taskType,
		})
	}
	return out
}
