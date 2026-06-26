package sandbox

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/queue"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/tools/logger"
)

// RunJob represents an async code execution task.
type RunJob struct {
	ID       string
	Language string
	Source   string
}

// Service submits and tracks sandboxed code runs.
type Service interface {
	SubmitRun(ctx context.Context, language, source string) (*RunJob, error)
	GetRunResult(ctx context.Context, jobID string) (string, error)
}

type service struct {
	q   queue.Broker
	log logger.Logger
}

// NewService constructs the sandbox domain service.
func NewService(q queue.Broker, log logger.Logger) Service {
	return &service{q: q, log: log}
}

func (s *service) SubmitRun(_ context.Context, _, _ string) (*RunJob, error) {
	return nil, nil // TODO
}

func (s *service) GetRunResult(_ context.Context, _ string) (string, error) {
	return "", nil // TODO
}
