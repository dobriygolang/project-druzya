package repository

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/identity/model"
)

// UserRepository persists and loads users.
type UserRepository interface {
	GetByID(ctx context.Context, id string) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	Create(ctx context.Context, email, name string) (*model.User, error)
}
