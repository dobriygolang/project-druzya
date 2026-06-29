package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	notesmodel "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	defaultListLimit = 100
	maxListLimit     = 200
)

func (r *Repository) ListNotes(
	ctx context.Context,
	userID string,
	f ListNotesFilter,
) ([]notesmodel.NoteSummary, string, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	args := []any{userID}
	query := `
		SELECT id, title, updated_at, size_bytes, folder_id
		FROM notes
		WHERE user_id = $1 AND archived_at IS NULL
	`
	if f.FolderID != nil {
		args = append(args, *f.FolderID)
		query += fmt.Sprintf(" AND folder_id = $%d", len(args))
	}
	if f.Cursor != "" {
		parts := strings.SplitN(f.Cursor, "|", 2)
		if len(parts) == 2 {
			cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
			if err == nil {
				args = append(args, cursorTime, parts[1])
				n := len(args)
				query += fmt.Sprintf(" AND (updated_at, id) < ($%d, $%d)", n-1, n)
			}
		}
	}
	args = append(args, limit+1)
	query += fmt.Sprintf(" ORDER BY updated_at DESC, id DESC LIMIT $%d", len(args))

	rows, err := r.pg.Query(ctx, query, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	out := make([]notesmodel.NoteSummary, 0, limit)
	for rows.Next() {
		var n notesmodel.NoteSummary
		var folderID *string
		if err := rows.Scan(&n.ID, &n.Title, &n.UpdatedAt, &n.SizeBytes, &folderID); err != nil {
			return nil, "", err
		}
		n.FolderID = folderID
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}

	var nextCursor string
	if len(out) > limit {
		last := out[limit-1]
		out = out[:limit]
		nextCursor = last.UpdatedAt.UTC().Format(time.RFC3339Nano) + "|" + last.ID
	}
	return out, nextCursor, nil
}

func (r *Repository) GetNote(ctx context.Context, userID, id string) (*notesmodel.Note, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, user_id, folder_id, title, body_md, encrypted, published, publish_slug,
		       published_at, size_bytes, created_at, updated_at
		FROM notes
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
	`, id, userID)
	return scanNote(row)
}

func (r *Repository) CreateNote(
	ctx context.Context,
	userID, title, body string,
	folderID *string,
) (*notesmodel.Note, error) {
	size := len(body)
	row := r.pg.QueryRow(ctx, `
		INSERT INTO notes (user_id, folder_id, title, body_md, size_bytes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, folder_id, title, body_md, encrypted, published, publish_slug,
		          published_at, size_bytes, created_at, updated_at
	`, userID, folderID, title, body, size)
	return scanNote(row)
}

func (r *Repository) UpdateNote(
	ctx context.Context,
	userID, id, title, body string,
) (*notesmodel.Note, error) {
	size := len(body)
	row := r.pg.QueryRow(ctx, `
		UPDATE notes
		SET title = $3, body_md = $4, size_bytes = $5, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
		RETURNING id, user_id, folder_id, title, body_md, encrypted, published, publish_slug,
		          published_at, size_bytes, created_at, updated_at
	`, id, userID, title, body, size)
	return scanNote(row)
}

func (r *Repository) DeleteNote(ctx context.Context, userID, id string) error {
	tag, err := r.pg.Exec(ctx, `
		UPDATE notes SET archived_at = now(), updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return notesmodel.ErrNotFound
	}
	return nil
}

func (r *Repository) MoveNote(
	ctx context.Context,
	userID, noteID string,
	folderID *string,
) (*notesmodel.Note, error) {
	row := r.pg.QueryRow(ctx, `
		UPDATE notes SET folder_id = $3, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
		RETURNING id, user_id, folder_id, title, body_md, encrypted, published, publish_slug,
		          published_at, size_bytes, created_at, updated_at
	`, noteID, userID, folderID)
	return scanNote(row)
}

func (r *Repository) GetNotesMeta(ctx context.Context, userID string) ([]notesmodel.NoteMeta, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT id, encrypted, published
		FROM notes
		WHERE user_id = $1 AND archived_at IS NULL
		ORDER BY updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]notesmodel.NoteMeta, 0)
	for rows.Next() {
		var m notesmodel.NoteMeta
		if err := rows.Scan(&m.ID, &m.Encrypted, &m.Published); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) CountActiveNotes(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.pg.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM notes WHERE user_id = $1 AND archived_at IS NULL
	`, userID).Scan(&n)
	return n, err
}

func (r *Repository) SumActiveNoteBytes(ctx context.Context, userID string) (int64, error) {
	var sum int64
	err := r.pg.QueryRow(ctx, `
		SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM notes WHERE user_id = $1 AND archived_at IS NULL
	`, userID).Scan(&sum)
	return sum, err
}

func (r *Repository) EncryptNote(ctx context.Context, userID, noteID, ciphertext string) error {
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

func (r *Repository) PermanentlyDecryptNote(ctx context.Context, userID, noteID, plaintext string) error {
	size := len(plaintext)
	tag, err := r.pg.Exec(ctx, `
		UPDATE notes
		SET body_md = $3, encrypted = false, size_bytes = $4, updated_at = now()
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
	`, noteID, userID, plaintext, size)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return notesmodel.ErrNotFound
	}
	return nil
}

func scanNote(row pgx.Row) (*notesmodel.Note, error) {
	var n notesmodel.Note
	var folderID, publishSlug *string
	var publishedAt *time.Time
	err := row.Scan(
		&n.ID, &n.UserID, &folderID, &n.Title, &n.BodyMD, &n.Encrypted, &n.Published,
		&publishSlug, &publishedAt, &n.SizeBytes, &n.CreatedAt, &n.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, notesmodel.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	n.FolderID = folderID
	n.PublishSlug = publishSlug
	n.PublishedAt = publishedAt
	return &n, nil
}

func newPublishSlug(title string) string {
	base := strings.ToLower(strings.TrimSpace(title))
	var b strings.Builder
	for _, r := range base {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else if r == ' ' || r == '-' || r == '_' {
			b.WriteRune('-')
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		slug = "note"
	}
	if len(slug) > 40 {
		slug = slug[:40]
	}
	return slug + "-" + uuid.NewString()[:8]
}

func publishURL(base, slug string) string {
	base = strings.TrimRight(base, "/")
	return base + "/n/" + slug
}
