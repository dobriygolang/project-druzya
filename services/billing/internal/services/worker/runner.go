package worker

import (
	"context"

	domain "github.com/sedorofeevd/project-druzya/services/billing/internal/billing"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/logger"
)

// Deps lists dependencies for background consumers.
type Deps struct {
	Log     logger.Logger
	Service domain.Service
}

// Run starts queue consumers and blocks until ctx is cancelled.
func Run(ctx context.Context, deps Deps) error {
	deps.Log.Info("worker starting", "service", "billing")

	// TODO: subscribe to queue topics for billing
	_ = deps.Service

	<-ctx.Done()
	deps.Log.Info("worker shutting down", "service", "billing")
	return nil
}
