package tracker

import (
	"context"
	"time"
)

type OutboxEvent struct {
	ID         string
	EventName  string
	Payload    map[string]any
	OccurredAt time.Time
}

type CreateTaskParams struct {
	UserID       string
	Title        string
	Source       string
	Metadata     map[string]any
	DedupKey     *string
	EpicName     *string
	EstimateDays *float64
}

type UserSettings struct {
	SmartParseEnabled         bool
	GoogleCalendarSyncEnabled bool
	GoogleCalendarConnected   bool
	DeferredSprintEpicNames   []string
}

// Client calls tracker internal API.
type Client interface {
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]OutboxEvent, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id, errMsg string) error
	CreateTaskInternal(ctx context.Context, params CreateTaskParams) (created bool, err error)
	EnsureLearningBoard(ctx context.Context, userID string) error
	GetUserSettings(ctx context.Context, userID string) (*UserSettings, error)
	PatchTaskMetadata(ctx context.Context, userID, taskID string, metadata map[string]any) error
	Ping(ctx context.Context) error
}
