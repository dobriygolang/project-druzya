package repository

import (
	"context"
	"errors"
	"time"

	notesmodel "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/model"
	"github.com/jackc/pgx/v5"
)

func (r *Repository) ListFolders(ctx context.Context, userID string) ([]notesmodel.Folder, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT id, user_id, name, parent_id, created_at, updated_at
		FROM note_folders
		WHERE user_id = $1
		ORDER BY name ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]notesmodel.Folder, 0)
	for rows.Next() {
		var f notesmodel.Folder
		var parentID *string
		if err := rows.Scan(&f.ID, &f.UserID, &f.Name, &parentID, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		f.ParentID = parentID
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *Repository) CreateFolder(
	ctx context.Context,
	userID, name string,
	parentID *string,
) (*notesmodel.Folder, error) {
	row := r.pg.QueryRow(ctx, `
		INSERT INTO note_folders (user_id, name, parent_id)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, name, parent_id, created_at, updated_at
	`, userID, name, parentID)
	return scanFolder(row)
}

func (r *Repository) DeleteFolder(ctx context.Context, userID, id string, moveNotesToRoot bool) error {
	tx, err := r.pg.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if moveNotesToRoot {
		if _, err := tx.Exec(ctx, `
			UPDATE notes SET folder_id = NULL, updated_at = now()
			WHERE user_id = $1 AND folder_id = $2
		`, userID, id); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE notes SET archived_at = now(), updated_at = now()
			WHERE user_id = $1 AND folder_id = $2 AND archived_at IS NULL
		`, userID, id); err != nil {
			return err
		}
	}

	tag, err := tx.Exec(ctx, `DELETE FROM note_folders WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return notesmodel.ErrNotFound
	}
	return tx.Commit(ctx)
}

func (r *Repository) PublishNote(
	ctx context.Context,
	userID, noteID, publicBaseURL string,
) (*notesmodel.PublishStatus, error) {
	note, err := r.GetNote(ctx, userID, noteID)
	if err != nil {
		return nil, err
	}
	if note.Encrypted {
		return nil, notesmodel.ErrInvalidArgument
	}
	if note.Published && note.PublishSlug != nil {
		return &notesmodel.PublishStatus{
			Published:   true,
			Slug:        *note.PublishSlug,
			URL:         publishURL(publicBaseURL, *note.PublishSlug),
			PublishedAt: note.PublishedAt,
		}, nil
	}

	slug := newPublishSlug(note.Title)
	now := time.Now().UTC()
	row := r.pg.QueryRow(ctx, `
		UPDATE notes
		SET published = true, publish_slug = $3, published_at = $4, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL AND encrypted = false
		RETURNING publish_slug, published_at
	`, noteID, userID, slug, now)
	var outSlug string
	var publishedAt time.Time
	if err := row.Scan(&outSlug, &publishedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, notesmodel.ErrNotFound
		}
		return nil, err
	}
	return &notesmodel.PublishStatus{
		Published:   true,
		Slug:        outSlug,
		URL:         publishURL(publicBaseURL, outSlug),
		PublishedAt: &publishedAt,
	}, nil
}

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

func scanFolder(row pgx.Row) (*notesmodel.Folder, error) {
	var f notesmodel.Folder
	var parentID *string
	err := row.Scan(&f.ID, &f.UserID, &f.Name, &parentID, &f.CreatedAt, &f.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, notesmodel.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	f.ParentID = parentID
	return &f, nil
}
