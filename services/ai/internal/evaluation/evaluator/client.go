package evaluator

import (
	"context"
	"encoding/json"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

// Input is everything needed to score one attempt.
type Input struct {
	TaskType        string
	TaskTitle       string
	TaskDescription string
	Criteria        []Criterion
	Solutions       []Solution
	AnswerText      string
	Code            string
	Language        string
	OffTopicPenalty float64
	UserTier        llmchain.SubscriptionPlan
	DiagramPNGURL   string
}

// Criterion is one rubric row for the judge prompt.
type Criterion struct {
	Key         string
	Title       string
	Description string
	Weight      int
	MaxScore    int
}

// Solution is reference material for the judge (not shown to candidate).
type Solution struct {
	Language     string
	SolutionText string
}

// CallRecord is one LLM hop audit row.
type CallRecord struct {
	Provider         string
	Model            string
	RequestJSON      []byte
	ResponseJSON     []byte
	ParsedResult     json.RawMessage
	PromptTokens     *int
	CompletionTokens *int
	TotalTokens      *int
	CostUSD          *float64
	LatencyMS        int
	Error            *string
}

// CriterionScore is one rubric row score from the judge.
type CriterionScore struct {
	Key      string
	Score    float64
	MaxScore float64
}

// Output is the scored attempt plus LLM audit trail.
type Output struct {
	Result     *evaluationmodel.EvaluationResult
	WaterScore float64
	Criteria   []CriterionScore
	Calls      []CallRecord
}

// Client runs 2-pass LLM evaluation for interview attempts.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	Evaluate(ctx context.Context, in Input) (*Output, error)
}
