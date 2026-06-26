package content

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/content/internal/adapter/postgres"
	"github.com/sedorofeevd/project-druzya/services/content/internal/tools/logger"
)

// Lesson represents educational material.
type Lesson struct {
	ID    string
	Title string
	Body  string
}

// Service manages courses, lessons and learning content.
type Service interface {
	GetLesson(ctx context.Context, id string) (*Lesson, error)
	ListLessons(ctx context.Context, courseID string) ([]Lesson, error)
}

type service struct {
	pg  *postgres.Pool
	log logger.Logger
}

// NewService constructs the content domain service.
func NewService(pg *postgres.Pool, log logger.Logger) Service {
	return &service{pg: pg, log: log}
}

func (s *service) GetLesson(_ context.Context, _ string) (*Lesson, error) {
	return nil, nil // TODO
}

func (s *service) ListLessons(_ context.Context, _ string) ([]Lesson, error) {
	return nil, nil // TODO
}
