package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

// ListArticleReadSlugs returns article slugs the user has marked as read.
func (r *Repository) ListArticleReadSlugs(ctx context.Context, userID string) ([]string, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT article_slug FROM article_reads
		WHERE user_id = $1
		ORDER BY read_at DESC
	`, uid)
	if err != nil {
		return nil, fmt.Errorf("list article reads: %w", err)
	}
	defer rows.Close()

	var slugs []string
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err != nil {
			return nil, err
		}
		slugs = append(slugs, slug)
	}
	return slugs, rows.Err()
}

// UpsertArticleRead records that a user read an article.
func (r *Repository) UpsertArticleRead(ctx context.Context, userID, slug string) (*model.ArticleRead, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, fmt.Errorf("article slug is required")
	}

	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO article_reads (user_id, article_slug)
		VALUES ($1, $2)
		ON CONFLICT (user_id, article_slug) DO UPDATE SET read_at = now()
		RETURNING article_slug, read_at
	`, uid, slug)

	var read model.ArticleRead
	if err := row.Scan(&read.Slug, &read.ReadAt); err != nil {
		return nil, fmt.Errorf("upsert article read: %w", err)
	}
	return &read, nil
}
