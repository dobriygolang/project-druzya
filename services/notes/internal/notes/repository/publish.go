package repository

import (
	"context"
	"errors"
	"time"

	notesmodel "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/model"
	"github.com/jackc/pgx/v5"
)

func (r *Repository) UnpublishNote(ctx context.Context, userID, noteID string) error {
	tag, err := r.pg.Exec(ctx, `
		UPDATE notes
		SET published = false, publish_slug = NULL, published_at = NULL, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
	`, noteID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return notesmodel.ErrNotFound
	}
	return nil
}

func (r *Repository) GetPublishStatus(
	ctx context.Context,
	userID, noteID, publicBaseURL string,
) (*notesmodel.PublishStatus, error) {
	note, err := r.GetNote(ctx, userID, noteID)
	if err != nil {
		return nil, err
	}
	out := &notesmodel.PublishStatus{Published: note.Published}
	if note.PublishSlug != nil {
		out.Slug = *note.PublishSlug
		out.URL = publishURL(publicBaseURL, *note.PublishSlug)
	}
	out.PublishedAt = note.PublishedAt
	return out, nil
}

func (r *Repository) ShareNoteToWeb(
	ctx context.Context,
	userID, noteID, plaintext, publicBaseURL string,
) (*notesmodel.ShareToWebResult, error) {
	note, err := r.GetNote(ctx, userID, noteID)
	if err != nil {
		return nil, err
	}
	if note.Published && note.PublishSlug != nil && note.PublishedAt != nil {
		return &notesmodel.ShareToWebResult{
			Slug:             *note.PublishSlug,
			URL:              publishURL(publicBaseURL, *note.PublishSlug),
			PublishedAt:      *note.PublishedAt,
			AlreadyPublished: true,
		}, nil
	}

	slug := newPublishSlug(note.Title)
	now := time.Now().UTC()
	size := len(plaintext)
	row := r.pg.QueryRow(ctx, `
		UPDATE notes
		SET body_md = $3, encrypted = false, published = true, publish_slug = $4,
		    published_at = $5, size_bytes = $6, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
		RETURNING publish_slug, published_at
	`, noteID, userID, plaintext, slug, now, size)
	var outSlug string
	var publishedAt time.Time
	if err := row.Scan(&outSlug, &publishedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, notesmodel.ErrNotFound
		}
		return nil, err
	}
	return &notesmodel.ShareToWebResult{
		Slug:        outSlug,
		URL:         publishURL(publicBaseURL, outSlug),
		PublishedAt: publishedAt,
	}, nil
}

func (r *Repository) MakeNotePrivate(ctx context.Context, userID, noteID, ciphertext string) error {
	size := len(ciphertext)
	tag, err := r.pg.Exec(ctx, `
		UPDATE notes
		SET body_md = $3, encrypted = true, published = false, publish_slug = NULL,
		    published_at = NULL, size_bytes = $4, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
	`, noteID, userID, ciphertext, size)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return notesmodel.ErrNotFound
	}
	return nil
}
