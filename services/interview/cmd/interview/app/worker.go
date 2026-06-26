package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/interview/internal/services/worker"
)

// RunWorker starts background job consumers and blocks until ctx is cancelled.
func RunWorker(ctx context.Context, a *App) error {
	return worker.Run(ctx, worker.Deps{
		Log:     a.Logger,
		Service: a.Service,
	})
}
