package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/outboxworker"
)

// RunWorker polls interview outbox and triggers evaluations.
func RunWorker(ctx context.Context, a *App) error {
	return outboxworker.Run(ctx, a.Logger, a.InterviewClient, &outboxworker.Handler{
		Interview: a.InterviewClient,
		Service:   a.Service,
	}, a.Config.WorkerPollInterval, 10)
}
