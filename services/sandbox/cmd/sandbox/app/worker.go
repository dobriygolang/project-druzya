package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/runworker"
)

// RunWorker starts the queued code-run worker.
func RunWorker(ctx context.Context, a *App) error {
	if !a.Config.AsyncRuns {
		a.Logger.Info("async runs disabled")
		<-ctx.Done()
		return ctx.Err()
	}
	return runworker.Run(ctx, a.Logger, a.Config.WorkerInterval, a.Config.WorkerBatchSize, a.Service)
}
