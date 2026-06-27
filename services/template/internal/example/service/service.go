package service

import (
	"context"
	"errors"

	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
	examplerepo "github.com/sedorofeevd/project-druzya/services/template/internal/example/repository"
	"github.com/sedorofeevd/project-druzya/services/template/internal/example/usecase/query/get_item"
)

const (
	defaultLimit = 50
	maxLimit     = 100
)

// ErrNotFound is returned when an entity does not exist.
var ErrNotFound = examplerepo.ErrNotFound

// ErrInvalidArgument is returned when required input is missing or malformed.
var ErrInvalidArgument = examplemodel.ErrInvalidArgument

// Service is example domain use cases — rename and extend for your service.
//
// The service is a thin orchestrator: simple reads stay inline, while richer
// operations delegate to a usecase package (see GetItem -> usecase/query/get_item).
type Service interface {
	Ping(ctx context.Context) (string, error)
	ListItems(ctx context.Context, limit, offset int) ([]examplemodel.Item, error)
	GetItem(ctx context.Context, id, slug string) (*examplemodel.Item, error)
}

type exampleService struct {
	repo    examplerepo.Store
	getItem *get_item.Handler
}

// Deps holds service dependencies. Repo is the Store port so the service is
// testable with a mock instead of a real database.
type Deps struct {
	Repo examplerepo.Store
}

// New constructs the domain service and wires usecase handlers.
func New(deps Deps) Service {
	return &exampleService{
		repo:    deps.Repo,
		getItem: get_item.New(deps.Repo),
	}
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

// GetItem delegates to the get_item CQRS query handler (reference pattern).
func (s *exampleService) GetItem(ctx context.Context, id, slug string) (*examplemodel.Item, error) {
	return s.getItem.Handle(ctx, get_item.Query{ID: id, Slug: slug})
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

// IsInvalidArgument reports whether err is an invalid-argument error.
func IsInvalidArgument(err error) bool {
	return errors.Is(err, ErrInvalidArgument)
}
