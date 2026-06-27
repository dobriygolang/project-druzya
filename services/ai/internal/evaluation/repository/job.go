package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

func (r *Repository) CreateJob(ctx context.Context, job *evaluationmodel.EvaluationJob) error {
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO evaluation_jobs (
			id, attempt_id, user_id, task_id, status, retry_count, retryable,
			error, next_retry_at, started_at, completed_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, job.ID, job.AttemptID, job.UserID, job.TaskID, string(job.Status), job.RetryCount, job.Retryable,
		job.Error, job.NextRetryAt, job.StartedAt, job.CompletedAt, job.CreatedAt, job.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return fmt.Errorf("insert evaluation job: %w", err)
	}
	return nil
}

func (r *Repository) GetJobByID(ctx context.Context, id string) (*evaluationmodel.EvaluationJob, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, attempt_id, user_id, task_id, status, retry_count, retryable,
		       error, next_retry_at, started_at, completed_at, created_at, updated_at
		FROM evaluation_jobs WHERE id = $1
	`, id)
	return scanJob(row)
}

func (r *Repository) GetJobByAttemptID(ctx context.Context, attemptID string) (*evaluationmodel.EvaluationJob, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, attempt_id, user_id, task_id, status, retry_count, retryable,
		       error, next_retry_at, started_at, completed_at, created_at, updated_at
		FROM evaluation_jobs WHERE attempt_id = $1
	`, attemptID)
	return scanJob(row)
}

func (r *Repository) ListJobs(ctx context.Context, status *evaluationmodel.JobStatus, limit int) ([]evaluationmodel.EvaluationJob, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, attempt_id, user_id, task_id, status, retry_count, retryable,
		       error, next_retry_at, started_at, completed_at, created_at, updated_at
		FROM evaluation_jobs
	`
	args := []any{}
	if status != nil {
		query += ` WHERE status = $1`
		args = append(args, string(*status))
	}
	query += ` ORDER BY created_at DESC LIMIT ` + fmt.Sprintf("%d", limit)

	rows, err := r.conn(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list evaluation jobs: %w", err)
	}
	defer rows.Close()

	var items []evaluationmodel.EvaluationJob
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *job)
	}
	return items, rows.Err()
}

func (r *Repository) UpdateJob(ctx context.Context, job *evaluationmodel.EvaluationJob) error {
	tag, err := r.conn(ctx).Exec(ctx, `
		UPDATE evaluation_jobs SET
			status = $2, retry_count = $3, retryable = $4, error = $5,
			next_retry_at = $6, started_at = $7, completed_at = $8, updated_at = $9
		WHERE id = $1
	`, job.ID, string(job.Status), job.RetryCount, job.Retryable, job.Error,
		job.NextRetryAt, job.StartedAt, job.CompletedAt, job.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update evaluation job: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListRetryableAttemptIDs returns attempt IDs of pending jobs whose backoff has elapsed.
func (r *Repository) ListRetryableAttemptIDs(ctx context.Context, now time.Time, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT attempt_id FROM evaluation_jobs
		WHERE status = 'pending' AND retryable = true
		  AND next_retry_at IS NOT NULL AND next_retry_at <= $1
		ORDER BY next_retry_at ASC
		LIMIT $2
	`, now.UTC(), limit)
	if err != nil {
		return nil, fmt.Errorf("list retryable jobs: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan retryable attempt id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ResetStuckRunningJobs moves jobs stuck in 'running' past the threshold back to
// 'pending' so they can be retried after a crash mid-evaluation.
func (r *Repository) ResetStuckRunningJobs(ctx context.Context, olderThan time.Time) (int64, error) {
	tag, err := r.conn(ctx).Exec(ctx, `
		UPDATE evaluation_jobs
		SET status = 'pending', next_retry_at = now(), updated_at = now()
		WHERE status = 'running' AND started_at IS NOT NULL AND started_at < $1
	`, olderThan.UTC())
	if err != nil {
		return 0, fmt.Errorf("reset stuck running jobs: %w", err)
	}
	return tag.RowsAffected(), nil
}

func scanJob(row pgx.Row) (*evaluationmodel.EvaluationJob, error) {
	var job evaluationmodel.EvaluationJob
	var status string
	err := row.Scan(
		&job.ID, &job.AttemptID, &job.UserID, &job.TaskID, &status,
		&job.RetryCount, &job.Retryable, &job.Error, &job.NextRetryAt,
		&job.StartedAt, &job.CompletedAt, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan evaluation job: %w", err)
	}
	job.Status = evaluationmodel.JobStatus(status)
	return &job, nil
}
