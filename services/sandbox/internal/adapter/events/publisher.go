package events

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

// Publisher emits sandbox domain events.
type Publisher interface {
	CodeRunCompleted(ctx context.Context, run *model.CodeRun) error
	CodeRunFailed(ctx context.Context, run *model.CodeRun) error
	AttemptSubmittedFromCodeRun(ctx context.Context, runID, attemptID string) error
}

// NoopPublisher drops events until a bus is wired.
type NoopPublisher struct{}

func (NoopPublisher) CodeRunCompleted(context.Context, *model.CodeRun) error { return nil }
func (NoopPublisher) CodeRunFailed(context.Context, *model.CodeRun) error    { return nil }
func (NoopPublisher) AttemptSubmittedFromCodeRun(context.Context, string, string) error {
	return nil
}
