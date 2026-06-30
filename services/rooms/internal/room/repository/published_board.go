package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
)

func (r *Repository) SetInitialScene(ctx context.Context, roomID uuid.UUID, sceneJSON string) error {
	const q = `UPDATE code_rooms SET initial_scene_json = $2 WHERE id = $1 AND archived_at IS NULL`
	tag, err := r.pg.Exec(ctx, q, roomID, sceneJSON)
	if err != nil {
		return fmt.Errorf("SetInitialScene: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) GetInitialScene(ctx context.Context, roomID uuid.UUID) (string, error) {
	const q = `SELECT COALESCE(initial_scene_json, '') FROM code_rooms WHERE id = $1 AND archived_at IS NULL`
	var scene string
	err := r.pg.QueryRow(ctx, q, roomID).Scan(&scene)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("GetInitialScene: %w", err)
	}
	return scene, nil
}

func (r *Repository) InsertPublishedBoard(
	ctx context.Context,
	userID uuid.UUID,
	slug, title, sceneJSON string,
) (model.PublishedBoard, error) {
	const q = `
INSERT INTO published_boards (user_id, slug, title, scene_json, published_at)
VALUES ($1, $2, $3, $4, now())
RETURNING id, user_id, slug, title, scene_json, published_at`

	var out model.PublishedBoard
	err := r.pg.QueryRow(ctx, q, userID, slug, title, sceneJSON).Scan(
		&out.ID, &out.UserID, &out.Slug, &out.Title, &out.SceneJSON, &out.PublishedAt,
	)
	if err != nil {
		return model.PublishedBoard{}, fmt.Errorf("InsertPublishedBoard: %w", err)
	}
	return out, nil
}

func (r *Repository) GetPublishedBoardBySlug(ctx context.Context, slug string) (model.PublishedBoard, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return model.PublishedBoard{}, ErrNotFound
	}
	const q = `
SELECT id, user_id, slug, title, scene_json, published_at
FROM published_boards
WHERE slug = $1 AND archived_at IS NULL`

	var out model.PublishedBoard
	err := r.pg.QueryRow(ctx, q, slug).Scan(
		&out.ID, &out.UserID, &out.Slug, &out.Title, &out.SceneJSON, &out.PublishedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.PublishedBoard{}, ErrNotFound
		}
		return model.PublishedBoard{}, fmt.Errorf("GetPublishedBoardBySlug: %w", err)
	}
	return out, nil
}

func NewBoardSlug(title string) string {
	b := strings.Builder{}
	for _, r := range strings.ToLower(title) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else if r == ' ' || r == '-' || r == '_' {
			b.WriteRune('-')
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		slug = "board"
	}
	if len(slug) > 40 {
		slug = slug[:40]
	}
	suffix := uuid.NewString()[:8]
	return slug + "-" + suffix
}

func (r *Repository) ArchivePublishedBoardsOlderThan(ctx context.Context, before time.Time) (int64, error) {
	tag, err := r.pg.Exec(ctx, `UPDATE published_boards SET archived_at = now() WHERE archived_at IS NULL AND published_at < $1`, before)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
