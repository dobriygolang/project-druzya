package worker

import (
	"context"

	domain "github.com/sedorofeevd/project-druzya/services/interview/internal/interview"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/logger"
)

// Deps lists dependencies for background consumers.
type Deps struct {
	Log     logger.Logger
	Service domain.Service
}

// Run starts queue consumers and blocks until ctx is cancelled.
func Run(ctx context.Context, deps Deps) error {
	deps.Log.Info("worker starting", "service", "interview")

	// TODO: subscribe to queue topics for interview
	_ = deps.Service

	<-ctx.Done()
	deps.Log.Info("worker shutting down", "service", "interview")
	return nil
}
