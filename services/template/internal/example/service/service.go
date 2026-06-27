package service

import (
	"context"
	"errors"
	"fmt"

	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
	examplerepo "github.com/sedorofeevd/project-druzya/services/template/internal/example/repository"
)

const (
	defaultLimit = 50
	maxLimit     = 100
)

// ErrNotFound is returned when an entity does not exist.
var ErrNotFound = examplerepo.ErrNotFound

// Service is example domain use cases — rename and extend for your service.
type Service interface {
	Ping(ctx context.Context) (string, error)
	ListItems(ctx context.Context, limit, offset int) ([]examplemodel.Item, error)
	GetItem(ctx context.Context, id, slug string) (*examplemodel.Item, error)
}

type exampleService struct {
	repo *examplerepo.Repository
}

// Deps holds service dependencies.
type Deps struct {
	Repo *examplerepo.Repository
}

// New constructs the domain service.
func New(deps Deps) Service {
	return &exampleService{repo: deps.Repo}
}

func (s *exampleService) Ping(_ context.Context) (string, error) {
	return "pong", nil
}

func (s *exampleService) ListItems(ctx context.Context, limit, offset int) ([]examplemodel.Item, error) {
	return s.repo.ListItems(ctx, examplerepo.ListItemsFilter{
		Limit:  normalizeLimit(limit),
		Offset: normalizeOffset(offset),
	})
}

func (s *exampleService) GetItem(ctx context.Context, id, slug string) (*examplemodel.Item, error) {
	switch {
	case id != "":
		return s.repo.GetItemByID(ctx, id)
	case slug != "":
		return s.repo.GetItemBySlug(ctx, slug)
	default:
		return nil, fmt.Errorf("id or slug is required: %w", ErrNotFound)
	}
}

func normalizeLimit(limit int) int {
	switch {
	case limit <= 0:
		return defaultLimit
	case limit > maxLimit:
		return maxLimit
	default:
		return limit
	}
}

func normalizeOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}

// IsNotFound reports whether err is a not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}
