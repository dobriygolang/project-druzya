package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func (r *Repository) CreateRetryItem(ctx context.Context, item *interviewmodel.RetryItem) error {
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO retry_items (
			id, user_id, task_id, source_attempt_id, session_id, reason, status,
			next_retry_at, resolved_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, item.ID, item.UserID, item.TaskID, item.SourceAttemptID, item.SessionID, item.Reason,
		string(item.Status), item.NextRetryAt, item.ResolvedAt, item.CreatedAt, item.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert retry item: %w", err)
	}
	return nil
}

func (r *Repository) GetRetryItemForUser(ctx context.Context, userID, retryItemID string) (*interviewmodel.RetryItem, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, task_id, source_attempt_id, session_id, reason, status,
		       next_retry_at, resolved_at, created_at, updated_at
		FROM retry_items
		WHERE id = $1 AND user_id = $2
	`, retryItemID, userID)
	return scanRetryItem(row)
}

func (r *Repository) ListRetryItems(ctx context.Context, userID string, status *interviewmodel.RetryItemStatus) ([]interviewmodel.RetryItem, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, user_id, task_id, source_attempt_id, session_id, reason, status,
		       next_retry_at, resolved_at, created_at, updated_at
		FROM retry_items
		WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
		ORDER BY created_at DESC
	`, userID, statusPtrToString(status))
	if err != nil {
		return nil, fmt.Errorf("list retry items: %w", err)
	}
	defer rows.Close()

	var items []interviewmodel.RetryItem
	for rows.Next() {
		item, err := scanRetryItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetRetryItemsByIDs(ctx context.Context, userID string, ids []string) ([]interviewmodel.RetryItem, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, user_id, task_id, source_attempt_id, session_id, reason, status,
		       next_retry_at, resolved_at, created_at, updated_at
		FROM retry_items
		WHERE user_id = $1 AND id = ANY($2) AND status = 'pending'
	`, userID, ids)
	if err != nil {
		return nil, fmt.Errorf("get retry items: %w", err)
	}
	defer rows.Close()

	var items []interviewmodel.RetryItem
	for rows.Next() {
		item, err := scanRetryItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) ListPendingRetryItems(ctx context.Context, userID string) ([]interviewmodel.RetryItem, error) {
	status := interviewmodel.RetryStatusPending
	return r.ListRetryItems(ctx, userID, &status)
}

func (r *Repository) ListRetryItemsBySession(ctx context.Context, sessionID string) ([]interviewmodel.RetryItem, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, user_id, task_id, source_attempt_id, session_id, reason, status,
		       next_retry_at, resolved_at, created_at, updated_at
		FROM retry_items
		WHERE session_id = $1
	`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("list retry by session: %w", err)
	}
	defer rows.Close()

	var items []interviewmodel.RetryItem
	for rows.Next() {
		item, err := scanRetryItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) UpdateRetryItem(ctx context.Context, item *interviewmodel.RetryItem) error {
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE retry_items
		SET status = $2, session_id = $3, resolved_at = $4, updated_at = $5
		WHERE id = $1
	`, item.ID, string(item.Status), item.SessionID, item.ResolvedAt, item.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update retry item: %w", err)
	}
	return nil
}

func (r *Repository) MarkRetryItemsInProgress(ctx context.Context, ids []string, sessionID string, updatedAt time.Time) error {
	return r.markRetryItemsInProgress(ctx, ids, sessionID, updatedAt)
}

func scanRetryItem(row pgx.Row) (*interviewmodel.RetryItem, error) {
	var item interviewmodel.RetryItem
	var status string
	err := row.Scan(
		&item.ID, &item.UserID, &item.TaskID, &item.SourceAttemptID, &item.SessionID,
		&item.Reason, &status, &item.NextRetryAt, &item.ResolvedAt,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan retry item: %w", err)
	}
	item.Status = interviewmodel.RetryItemStatus(status)
	return &item, nil
}

func statusPtrToString(status *interviewmodel.RetryItemStatus) *string {
	if status == nil {
		return nil
	}
	s := string(*status)
	return &s
}
