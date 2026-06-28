package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

// UpsertUserTaskProgress records or updates per-task progress for a user.
func (r *Repository) UpsertUserTaskProgress(ctx context.Context, userID, taskID, taskType string, score int, passed bool, seenAt time.Time) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	tid, err := uuid.Parse(taskID)
	if err != nil {
		return fmt.Errorf("invalid task_id: %w", err)
	}

	var firstPassedAt, lastPassedAt *time.Time
	if passed {
		firstPassedAt = &seenAt
		lastPassedAt = &seenAt
	}

	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO user_task_progress (
			user_id, task_id, task_type, best_score, passed, attempts_count,
			first_passed_at, last_passed_at, last_attempt_at
		)
		VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8)
		ON CONFLICT (user_id, task_id) DO UPDATE SET
			task_type = EXCLUDED.task_type,
			best_score = GREATEST(user_task_progress.best_score, EXCLUDED.best_score),
			passed = user_task_progress.passed OR EXCLUDED.passed,
			attempts_count = user_task_progress.attempts_count + 1,
			first_passed_at = COALESCE(user_task_progress.first_passed_at, EXCLUDED.first_passed_at),
			last_passed_at = CASE
				WHEN EXCLUDED.passed THEN EXCLUDED.last_passed_at
				ELSE user_task_progress.last_passed_at
			END,
			last_attempt_at = EXCLUDED.last_attempt_at,
			updated_at = now()
	`, uid, tid, taskType, score, passed, firstPassedAt, lastPassedAt, seenAt)
	return err
}

// ListPassedTaskIDsByType returns task IDs the user has passed for a task type.
func (r *Repository) ListPassedTaskIDsByType(ctx context.Context, userID, taskType string) ([]string, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}

	rows, err := r.conn(ctx).Query(ctx, `
		SELECT task_id
		FROM user_task_progress
		WHERE user_id = $1 AND task_type = $2 AND passed = true
		ORDER BY last_passed_at DESC NULLS LAST
	`, uid, taskType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var taskID uuid.UUID
		if err := rows.Scan(&taskID); err != nil {
			return nil, err
		}
		out = append(out, taskID.String())
	}
	return out, rows.Err()
}

// ListReviewTaskCandidates returns passed tasks stale since staleAfter.
func (r *Repository) ListReviewTaskCandidates(ctx context.Context, userID, taskType string, staleAfter time.Time, limit int) ([]model.ReviewTaskCandidate, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	if limit <= 0 {
		limit = 20
	}

	rows, err := r.conn(ctx).Query(ctx, `
		SELECT task_id, task_type, best_score, last_passed_at
		FROM user_task_progress
		WHERE user_id = $1
			AND task_type = $2
			AND passed = true
			AND last_passed_at IS NOT NULL
			AND last_passed_at < $3
		ORDER BY last_passed_at ASC
		LIMIT $4
	`, uid, taskType, staleAfter, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.ReviewTaskCandidate
	for rows.Next() {
		var c model.ReviewTaskCandidate
		var taskID uuid.UUID
		var lastPassedAt time.Time
		if err := rows.Scan(&taskID, &c.TaskType, &c.BestScore, &lastPassedAt); err != nil {
			return nil, err
		}
		c.TaskID = taskID.String()
		c.LastPassedAt = lastPassedAt
		out = append(out, c)
	}
	return out, rows.Err()
}

// UpsertUserTemplateProgress records or updates company template progress.
func (r *Repository) UpsertUserTemplateProgress(ctx context.Context, userID, templateID, sessionID string, totalScore, passingScore int, seenAt time.Time) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	tplID, err := uuid.Parse(templateID)
	if err != nil {
		return fmt.Errorf("invalid template_id: %w", err)
	}

	var sessionUUID *uuid.UUID
	if sessionID != "" {
		parsed, parseErr := uuid.Parse(sessionID)
		if parseErr != nil {
			return fmt.Errorf("invalid session_id: %w", parseErr)
		}
		sessionUUID = &parsed
	}

	passed := totalScore >= passingScore
	var lastPassedAt *time.Time
	if passed {
		lastPassedAt = &seenAt
	}

	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO user_template_progress (
			user_id, template_id, best_total_score, passed, attempts_count,
			last_passed_at, last_session_id, last_attempt_at
		)
		VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
		ON CONFLICT (user_id, template_id) DO UPDATE SET
			best_total_score = GREATEST(user_template_progress.best_total_score, EXCLUDED.best_total_score),
			passed = user_template_progress.passed OR EXCLUDED.passed,
			attempts_count = user_template_progress.attempts_count + 1,
			last_passed_at = CASE
				WHEN EXCLUDED.passed THEN EXCLUDED.last_passed_at
				ELSE user_template_progress.last_passed_at
			END,
			last_session_id = EXCLUDED.last_session_id,
			last_attempt_at = EXCLUDED.last_attempt_at,
			updated_at = now()
	`, uid, tplID, totalScore, passed, lastPassedAt, sessionUUID, seenAt)
	return err
}

// ListUserTemplateProgress returns all template progress rows for a user.
func (r *Repository) ListUserTemplateProgress(ctx context.Context, userID string) ([]model.UserTemplateProgress, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}

	rows, err := r.conn(ctx).Query(ctx, `
		SELECT template_id, best_total_score, passed, attempts_count,
			last_passed_at, last_session_id, last_attempt_at, created_at, updated_at
		FROM user_template_progress
		WHERE user_id = $1
		ORDER BY last_attempt_at DESC
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.UserTemplateProgress
	for rows.Next() {
		var p model.UserTemplateProgress
		var templateID uuid.UUID
		var lastSessionID *uuid.UUID
		p.UserID = userID
		if err := rows.Scan(
			&templateID, &p.BestTotalScore, &p.Passed, &p.AttemptsCount,
			&p.LastPassedAt, &lastSessionID, &p.LastAttemptAt, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		p.TemplateID = templateID.String()
		if lastSessionID != nil {
			s := lastSessionID.String()
			p.LastSessionID = &s
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// UpsertPracticeModeActivity records the latest practice for a session mode.
func (r *Repository) UpsertPracticeModeActivity(ctx context.Context, userID, sessionMode, taskType string, passed bool, seenAt time.Time) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}

	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO user_practice_mode_activity (
			user_id, session_mode, task_type, last_practiced_at, passed_tasks_count, updated_at
		)
		VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN 1 ELSE 0 END, now())
		ON CONFLICT (user_id, session_mode) DO UPDATE SET
			task_type = EXCLUDED.task_type,
			last_practiced_at = EXCLUDED.last_practiced_at,
			passed_tasks_count = user_practice_mode_activity.passed_tasks_count + CASE WHEN $5 THEN 1 ELSE 0 END,
			updated_at = now()
	`, uid, sessionMode, taskType, seenAt, passed)
	return err
}

// ListPracticeModeActivity returns all practice mode rows for a user.
func (r *Repository) ListPracticeModeActivity(ctx context.Context, userID string) ([]model.UserPracticeModeActivity, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}

	rows, err := r.conn(ctx).Query(ctx, `
		SELECT session_mode, task_type, last_practiced_at, passed_tasks_count, updated_at
		FROM user_practice_mode_activity
		WHERE user_id = $1
		ORDER BY last_practiced_at ASC
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.UserPracticeModeActivity
	for rows.Next() {
		var a model.UserPracticeModeActivity
		a.UserID = userID
		if err := rows.Scan(&a.SessionMode, &a.TaskType, &a.LastPracticedAt, &a.PassedTasksCount, &a.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ListTaskTypeCoverage aggregates user_task_progress by task type.
func (r *Repository) ListTaskTypeCoverage(ctx context.Context, userID string) ([]model.TaskTypeCoverage, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}

	rows, err := r.conn(ctx).Query(ctx, `
		SELECT
			task_type,
			COUNT(*) FILTER (WHERE passed) AS passed_count,
			COALESCE(SUM(attempts_count), 0) AS attempts_count
		FROM user_task_progress
		WHERE user_id = $1
		GROUP BY task_type
		ORDER BY task_type
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.TaskTypeCoverage
	for rows.Next() {
		var c model.TaskTypeCoverage
		if err := rows.Scan(&c.TaskType, &c.PassedCount, &c.AttemptsCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
