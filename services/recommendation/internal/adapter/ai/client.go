package ai

import "context"

// ClassifyResult is the parsed task classification from ai-service.
type ClassifyResult struct {
	Kind     string
	Metadata map[string]any
	EpicHint *string
}

// Client calls ai-service internal RPCs used by recommendation.
type Client interface {
	ClassifyTrackerTask(ctx context.Context, title string) (*ClassifyResult, error)
	Ping(ctx context.Context) error
}
