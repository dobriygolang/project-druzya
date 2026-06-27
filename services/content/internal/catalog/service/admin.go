package service

import (
	"context"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// AdminService is internal catalog write API.
type AdminService interface {
	UpsertCompany(ctx context.Context, c catalogmodel.Company) (*catalogmodel.Company, error)
	UpsertTask(ctx context.Context, t catalogmodel.Task) (*catalogmodel.Task, error)
}

func (s *catalogService) UpsertCompany(ctx context.Context, c catalogmodel.Company) (*catalogmodel.Company, error) {
	if c.Slug == "" || c.Name == "" {
		return nil, fmt.Errorf("slug and name are required: %w", ErrInvalidArgument)
	}
	return s.repo.UpsertCompany(ctx, c)
}

func (s *catalogService) UpsertTask(ctx context.Context, t catalogmodel.Task) (*catalogmodel.Task, error) {
	if t.Slug == "" || t.Title == "" || t.Type == "" {
		return nil, fmt.Errorf("slug, title, and type are required: %w", ErrInvalidArgument)
	}
	if t.Status == "" {
		t.Status = "draft"
	}
	return s.repo.UpsertTask(ctx, t)
}
