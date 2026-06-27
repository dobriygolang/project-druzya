package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	examplemodel "github.com/sedorofeevd/project-druzya/services/template/internal/example/model"
)

// ListItemsFilter filters item list queries.
type ListItemsFilter struct {
	Limit  int
	Offset int
}

func (r *Repository) ListItems(ctx context.Context, f ListItemsFilter) ([]examplemodel.Item, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT id, slug, title, created_at, updated_at
		FROM items
		ORDER BY title
		LIMIT $1 OFFSET $2
	`, f.Limit, f.Offset)
	if err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}
	defer rows.Close()

	var items []examplemodel.Item
	for rows.Next() {
		item, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetItemByID(ctx context.Context, id string) (*examplemodel.Item, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, title, created_at, updated_at
		FROM items WHERE id = $1
	`, id)
	return scanItem(row)
}

func (r *Repository) GetItemBySlug(ctx context.Context, slug string) (*examplemodel.Item, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, title, created_at, updated_at
		FROM items WHERE slug = $1
	`, slug)
	return scanItem(row)
}

func scanItem(row pgx.Row) (*examplemodel.Item, error) {
	var item examplemodel.Item
	err := row.Scan(&item.ID, &item.Slug, &item.Title, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan item: %w", err)
	}
	return &item, nil
}
