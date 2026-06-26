package service

import (
	"context"
	"errors"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/identity/model"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/identity/repository"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/tools/logger"
)

// Service handles user profile operations.
type Service interface {
	GetUser(ctx context.Context, id string) (*model.User, error)
	CreateUser(ctx context.Context, email, name string) (*model.User, error)
}

// Deps lists dependencies for the identity service.
type Deps struct {
	Users repository.UserRepository
	Log   logger.Logger
}

type service struct {
	users repository.UserRepository
	log   logger.Logger
}

// New constructs the identity service.
func New(deps Deps) Service {
	return &service{
		users: deps.Users,
		log:   deps.Log,
	}
}

func (s *service) GetUser(ctx context.Context, id string) (*model.User, error) {
	user, err := s.users.GetByID(ctx, id)
	if err != nil {
		return nil, err // TODO: map repository errors to service errors
	}
	return user, nil
}

func (s *service) CreateUser(ctx context.Context, email, name string) (*model.User, error) {
	existing, err := s.users.GetByEmail(ctx, email)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	if existing != nil {
		return nil, ErrAlreadyExists
	}

	return s.users.Create(ctx, email, name)
}
