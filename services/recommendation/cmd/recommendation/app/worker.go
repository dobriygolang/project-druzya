package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/outboxbus"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/outboxworker"
)

// RunWorker starts the outbox polling worker or NATS subscriber.
func RunWorker(ctx context.Context, a *App) error {
	h := &outboxworker.Handler{Interview: a.InterviewClient, Service: a.Service}
	if a.Config.NATSURL != "" && !a.Config.OutboxPollEnabled {
		return outboxbus.Run(ctx, a.Logger, a.Config.NATSURL, "recommendation-outbox",
			outboxworker.HandledEventNames(), h)
	}
	return outboxworker.Run(ctx, a.Logger, a.InterviewClient, h, a.Config.WorkerPollInterval, 10)
}
