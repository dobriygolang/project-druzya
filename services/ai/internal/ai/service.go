package ai

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
)

// Feedback is AI-generated review of a candidate answer.
type Feedback struct {
	Score   int
	Summary string
	Hints   []string
}

// Service wraps AI-powered features (hints, grading, question generation).
type Service interface {
	ReviewAnswer(ctx context.Context, question, answer string) (*Feedback, error)
	GenerateQuestion(ctx context.Context, topic string, difficulty int) (string, error)
}

type service struct {
	log logger.Logger
}

// NewService constructs the AI domain service.
func NewService(log logger.Logger) Service {
	return &service{log: log}
}

func (s *service) ReviewAnswer(_ context.Context, _, _ string) (*Feedback, error) {
	return nil, nil // TODO
}

func (s *service) GenerateQuestion(_ context.Context, _ string, _ int) (string, error) {
	return "", nil // TODO
}
