package repository

import (
	"context"
	"encoding/json"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// UpsertCompany inserts or updates a company by id or slug.
func (r *Repository) UpsertCompany(ctx context.Context, c catalogmodel.Company) (*catalogmodel.Company, error) {
	row := r.pg.QueryRow(ctx, `
		INSERT INTO companies (id, slug, name, description, is_active)
		VALUES (
			COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()),
			$2, $3, $4, $5
		)
		ON CONFLICT (slug) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			is_active = EXCLUDED.is_active,
			updated_at = now()
		RETURNING id, slug, name, description, is_active, created_at, updated_at
	`, nullUUID(c.ID), c.Slug, c.Name, c.Description, c.IsActive)
	return scanCompany(row)
}

// UpsertTask inserts or updates a task by id or slug.
func (r *Repository) UpsertTask(ctx context.Context, t catalogmodel.Task) (*catalogmodel.Task, error) {
	meta, err := json.Marshal(t.Metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}
	row := r.pg.QueryRow(ctx, `
		INSERT INTO tasks (id, slug, type, title, description, difficulty, estimated_minutes, metadata, status)
		VALUES (
			COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()),
			$2, $3, $4, $5, $6, $7, $8::jsonb, $9
		)
		ON CONFLICT (slug) DO UPDATE SET
			type = EXCLUDED.type,
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			difficulty = EXCLUDED.difficulty,
			estimated_minutes = EXCLUDED.estimated_minutes,
			metadata = EXCLUDED.metadata,
			status = EXCLUDED.status,
			updated_at = now()
		RETURNING id, slug, type, title, description, difficulty, estimated_minutes, metadata, status, created_at, updated_at
	`, nullUUID(t.ID), t.Slug, t.Type, t.Title, t.Description, t.Difficulty, t.EstimatedMinutes, meta, t.Status)
	return scanTask(row)
}

func nullUUID(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}
