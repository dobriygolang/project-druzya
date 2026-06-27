package repository

import (
	"context"
	"fmt"
	"time"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// CreateRetrySession atomically creates a session bundle and marks retry items in progress.
func (r *Repository) CreateRetrySession(
	ctx context.Context,
	bundle SessionBundle,
	retryItemIDs []string,
	updatedAt time.Time,
) error {
	return r.WithTx(ctx, func(txCtx context.Context) error {
		if err := r.insertSessionBundle(txCtx, bundle); err != nil {
			return err
		}
		return r.markRetryItemsInProgress(txCtx, retryItemIDs, bundle.Session.ID, updatedAt)
	})
}

func (r *Repository) markRetryItemsInProgress(ctx context.Context, ids []string, sessionID string, updatedAt time.Time) error {
	if len(ids) == 0 {
		return fmt.Errorf("retry item ids required")
	}
	tag, err := r.conn(ctx).Exec(ctx, `
		UPDATE retry_items
		SET status = 'in_progress', session_id = $2, updated_at = $3
		WHERE id = ANY($1) AND status = 'pending'
	`, ids, sessionID, updatedAt)
	if err != nil {
		return fmt.Errorf("mark retry in progress: %w", err)
	}
	if tag.RowsAffected() != int64(len(ids)) {
		return ErrRetryItemsUnavailable
	}
	return nil
}

// CreateRetryItemIfAbsent inserts a pending retry item when none is active for the task.
func (r *Repository) CreateRetryItemIfAbsent(ctx context.Context, item *interviewmodel.RetryItem) (bool, error) {
	tag, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO retry_items (
			id, user_id, task_id, source_attempt_id, session_id, reason, status,
			next_retry_at, resolved_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (user_id, task_id) WHERE status IN ('pending', 'in_progress') DO NOTHING
	`, item.ID, item.UserID, item.TaskID, item.SourceAttemptID, item.SessionID, item.Reason,
		string(item.Status), item.NextRetryAt, item.ResolvedAt, item.CreatedAt, item.UpdatedAt)
	if err != nil {
		return false, fmt.Errorf("insert retry item: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}
