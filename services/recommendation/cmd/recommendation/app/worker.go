package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/outboxbus"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/outboxworker"
)

// RunWorker starts interview and tracker outbox polling workers.
func RunWorker(ctx context.Context, a *App) error {
	h := &outboxworker.Handler{Interview: a.InterviewClient, Service: a.Service}
	th := &outboxworker.TrackerHandler{Tracker: a.TrackerClient, Service: a.Service}

	errCh := make(chan error, 2)
	go func() {
		if a.Config.NATSURL != "" && !a.Config.OutboxPollEnabled {
			errCh <- outboxbus.Run(ctx, a.Logger, a.Config.NATSURL, "recommendation-outbox",
				outboxworker.HandledEventNames(), h)
			return
		}
		errCh <- outboxworker.Run(ctx, a.Logger, a.InterviewClient, h, a.Config.WorkerPollInterval, 10)
	}()
	go func() {
		errCh <- outboxworker.RunTracker(ctx, a.Logger, a.TrackerClient, th, a.Config.WorkerPollInterval, 10)
	}()

	select {
	case <-ctx.Done():
		return nil
	case err := <-errCh:
		return err
	}
}
