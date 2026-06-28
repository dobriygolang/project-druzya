package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/outboxbus"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/outboxworker"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/retryworker"
)

// RunWorker polls interview outbox or subscribes via NATS when relay is enabled.
func RunWorker(ctx context.Context, a *App) error {
	h := &outboxworker.Handler{
		Interview: a.InterviewClient,
		Service:   a.Service,
	}
	if a.Config.NATSURL != "" && !a.Config.OutboxPollEnabled {
		return outboxbus.Run(ctx, a.Logger, a.Config.NATSURL, "ai-outbox",
			[]string{outboxworker.AttemptSubmittedEvent}, h)
	}
	return outboxworker.Run(ctx, a.Logger, a.InterviewClient, h,
		a.Config.WorkerPollInterval, 10, a.Config.EvalWorkerConcurrency)
}

// RunRetryWorker drives delayed retries and recovers stuck running jobs.
func RunRetryWorker(ctx context.Context, a *App) error {
	return retryworker.Run(ctx, a.Logger, a.Repo, a.Service, retryworker.Config{})
}
