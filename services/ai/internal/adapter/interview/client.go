package interview

import (
	"context"
	"encoding/json"
	"time"
)

// Attempt is attempt data from interview-service.
type Attempt struct {
	ID            string
	UserID        string
	SessionTaskID string
	TaskID        string
	AnswerText    *string
	Code          *string
	Language      *string
	Attachments   json.RawMessage
	Status        string
}

// CompleteEvaluationInput holds evaluation completion data.
type CompleteEvaluationInput struct {
	AttemptID string
	Score     float64
	Passed    *bool
	Summary   *string
	Feedback  map[string]any
}

// OutboxEvent is a claimed domain outbox row.
type OutboxEvent struct {
	ID         string
	EventName  string
	Payload    map[string]any
	OccurredAt time.Time
}

// Client calls interview internal API.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	GetAttempt(ctx context.Context, attemptID string) (*Attempt, error)
	CompleteEvaluation(ctx context.Context, input CompleteEvaluationInput) error
	FailEvaluation(ctx context.Context, attemptID string, reason *string) error
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]OutboxEvent, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id, errMsg string) error
}
