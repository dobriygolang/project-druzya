package worker

import (
	"context"

	domain "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/tools/logger"
)

// Deps lists dependencies for background consumers.
type Deps struct {
	Log     logger.Logger
	Service domain.Service
}

// Run starts queue consumers and blocks until ctx is cancelled.
func Run(ctx context.Context, deps Deps) error {
	deps.Log.Info("worker starting", "service", "sandbox")

	// TODO: subscribe to queue topics for sandbox
	_ = deps.Service

	<-ctx.Done()
	deps.Log.Info("worker shutting down", "service", "sandbox")
	return nil
}
