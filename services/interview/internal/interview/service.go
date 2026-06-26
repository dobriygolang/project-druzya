package interview

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/postgres"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/queue"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/logger"
)

// Session represents an interview session between candidate and interviewer/AI.
type Session struct {
	ID          string
	CandidateID string
	Status      string
}

// Service orchestrates interview lifecycle and scoring.
type Service interface {
	StartSession(ctx context.Context, candidateID string) (*Session, error)
	CompleteSession(ctx context.Context, sessionID string) error
}

type service struct {
	pg  *postgres.Pool
	q   queue.Broker
	log logger.Logger
}

// NewService constructs the interview domain service.
func NewService(pg *postgres.Pool, q queue.Broker, log logger.Logger) Service {
	return &service{pg: pg, q: q, log: log}
}

func (s *service) StartSession(_ context.Context, _ string) (*Session, error) {
	return nil, nil // TODO
}

func (s *service) CompleteSession(_ context.Context, _ string) error {
	return nil // TODO
}
