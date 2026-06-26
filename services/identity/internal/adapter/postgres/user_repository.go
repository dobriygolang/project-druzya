package postgres

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/identity/model"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/identity/repository"
)

// UserRepository stores users in PostgreSQL.
type UserRepository struct {
	pg *Pool
}

// NewUserRepository constructs a postgres-backed user repository.
func NewUserRepository(pg *Pool) *UserRepository {
	return &UserRepository{pg: pg}
}

func (r *UserRepository) GetByID(_ context.Context, _ string) (*model.User, error) {
	return nil, repository.ErrNotFound // TODO: SQL query
}

func (r *UserRepository) GetByEmail(_ context.Context, _ string) (*model.User, error) {
	return nil, repository.ErrNotFound // TODO: SQL query
}

func (r *UserRepository) Create(_ context.Context, _, _ string) (*model.User, error) {
	return nil, nil // TODO: SQL insert
}
