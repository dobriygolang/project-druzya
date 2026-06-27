package interview

import (
	"context"
	"time"
)

// OutboxClaimAll requests every pending outbox event type from interview-service.
const OutboxClaimAll = "*"

// OutboxEvent is a claimed domain outbox row.
type OutboxEvent struct {
	ID        string
	EventName string
	Payload   map[string]any
}

// EvaluationSummary is evaluation result from interview-service.
type EvaluationSummary struct {
	AttemptID string
	Score     float64
	Passed    bool
	Feedback  map[string]any
	CreatedAt time.Time
}

// RetryItem is a pending retry queue item.
type RetryItem struct {
	ID     string
	UserID string
	TaskID string
	Status string
}

// Client calls interview internal API.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]OutboxEvent, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id, errMsg string) error
	GetEvaluationSummary(ctx context.Context, attemptID string) (*EvaluationSummary, error)
	ListPendingRetryItems(ctx context.Context, userID string) ([]RetryItem, error)
}
