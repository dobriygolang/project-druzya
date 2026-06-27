package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/outboxworker"
)

// RunWorker starts the outbox polling worker.
func RunWorker(ctx context.Context, a *App) error {
	return outboxworker.Run(ctx, a.Logger, a.InterviewClient,
		&outboxworker.Handler{Interview: a.InterviewClient, Service: a.Service},
		a.Config.WorkerPollInterval, 10)
}
