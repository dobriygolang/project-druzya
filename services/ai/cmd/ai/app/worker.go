package app

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/outboxworker"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/retryworker"
)

// RunWorker polls interview outbox and triggers evaluations.
func RunWorker(ctx context.Context, a *App) error {
	return outboxworker.Run(ctx, a.Logger, a.InterviewClient, &outboxworker.Handler{
		Interview: a.InterviewClient,
		Service:   a.Service,
	}, a.Config.WorkerPollInterval, 10, a.Config.EvalWorkerConcurrency)
}

// RunRetryWorker drives delayed retries and recovers stuck running jobs.
func RunRetryWorker(ctx context.Context, a *App) error {
	return retryworker.Run(ctx, a.Logger, a.Repo, a.Service, retryworker.Config{})
}
