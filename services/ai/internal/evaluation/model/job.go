package model

import (
	"encoding/json"
	"time"

	"github.com/shopspring/decimal"
)

// EvaluationJob tracks AI evaluation for one attempt.
type EvaluationJob struct {
	ID          string
	AttemptID   string
	UserID      string
	TaskID      string
	Status      JobStatus
	RetryCount  int
	Retryable   bool
	Error       *string
	NextRetryAt *time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// ModelCall records one LLM request/response for a job.
type ModelCall struct {
	ID               string
	EvaluationJobID  string
	Provider         string
	Model            string
	RequestJSON      json.RawMessage
	ResponseJSON     json.RawMessage
	ParsedResult     json.RawMessage
	PromptTokens     *int
	CompletionTokens *int
	TotalTokens      *int
	CostUSD          *decimal.Decimal
	LatencyMS        *int
	Error            *string
	CallNo           int
	CreatedAt        time.Time
}

// EvaluationResult is structured LLM output for an attempt.
type EvaluationResult struct {
	Score        float64
	Passed       *bool
	Summary      string
	Strengths    []string
	Improvements []string
	Feedback     map[string]any
}

// AttemptSubmittedEvent is consumed from interview outbox.
type AttemptSubmittedEvent struct {
	AttemptID     string
	UserID        string
	TaskID        string
	SessionID     string
	SessionTaskID string
}
