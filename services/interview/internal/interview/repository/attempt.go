package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func (r *Repository) CreateAttempt(ctx context.Context, attempt *interviewmodel.Attempt) error {
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO attempts (
			id, user_id, session_task_id, task_id, answer_text, code, language,
			attachments, status, submitted_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`, attempt.ID, attempt.UserID, attempt.SessionTaskID, attempt.TaskID,
		attempt.AnswerText, attempt.Code, attempt.Language, attempt.Attachments,
		string(attempt.Status), attempt.SubmittedAt, attempt.CreatedAt, attempt.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return fmt.Errorf("insert attempt: %w", err)
	}
	return nil
}

func (r *Repository) GetAttemptByID(ctx context.Context, id string) (*interviewmodel.Attempt, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, session_task_id, task_id, answer_text, code, language,
		       attachments, status, submitted_at, created_at, updated_at
		FROM attempts WHERE id = $1
	`, id)
	return scanAttempt(row)
}

func (r *Repository) GetAttemptForUser(ctx context.Context, userID, attemptID string) (*interviewmodel.Attempt, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, session_task_id, task_id, answer_text, code, language,
		       attachments, status, submitted_at, created_at, updated_at
		FROM attempts WHERE id = $1 AND user_id = $2
	`, attemptID, userID)
	return scanAttempt(row)
}

func (r *Repository) UpdateAttempt(ctx context.Context, attempt *interviewmodel.Attempt) error {
	tag, err := r.conn(ctx).Exec(ctx, `
		UPDATE attempts SET status = $2, updated_at = $3
		WHERE id = $1 AND status = $4
	`, attempt.ID, string(attempt.Status), attempt.UpdatedAt, string(interviewmodel.AttemptStatusEvaluating))
	if err != nil {
		return fmt.Errorf("update attempt: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrConflict
	}
	return nil
}

func (r *Repository) CreateEvaluationSummary(ctx context.Context, summary *interviewmodel.EvaluationSummary) error {
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO evaluation_summaries (
			id, attempt_id, score, passed, summary, feedback, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (attempt_id) DO UPDATE SET
			score = EXCLUDED.score,
			passed = EXCLUDED.passed,
			summary = EXCLUDED.summary,
			feedback = EXCLUDED.feedback,
			updated_at = EXCLUDED.updated_at
	`, summary.ID, summary.AttemptID, summary.Score.String(), summary.Passed,
		summary.Summary, summary.Feedback, summary.CreatedAt, summary.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert evaluation summary: %w", err)
	}
	return nil
}

func (r *Repository) GetEvaluationSummaryByAttemptID(ctx context.Context, attemptID string) (*interviewmodel.EvaluationSummary, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, attempt_id, score, passed, summary, feedback, created_at, updated_at
		FROM evaluation_summaries
		WHERE attempt_id = $1
	`, attemptID)
	var summary interviewmodel.EvaluationSummary
	var score decimalScan
	err := row.Scan(
		&summary.ID, &summary.AttemptID, &score, &summary.Passed, &summary.Summary, &summary.Feedback,
		&summary.CreatedAt, &summary.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan evaluation summary: %w", err)
	}
	summary.Score = score.Decimal
	return &summary, nil
}

func (r *Repository) ListEvaluationsBySession(ctx context.Context, sessionID string) ([]interviewmodel.EvaluationWithAttempt, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT es.id, es.attempt_id, es.score, es.passed, es.summary, es.feedback,
		       es.created_at, es.updated_at,
		       a.id, a.user_id, a.session_task_id, a.task_id, a.answer_text, a.code, a.language,
		       a.attachments, a.status, a.submitted_at, a.created_at, a.updated_at,
		       st.section_id
		FROM evaluation_summaries es
		JOIN attempts a ON a.id = es.attempt_id
		JOIN session_tasks st ON st.id = a.session_task_id
		JOIN interview_session_sections sec ON sec.id = st.section_id
		WHERE st.session_id = $1
		ORDER BY sec.position, st.position
	`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("list evaluations: %w", err)
	}
	defer rows.Close()

	var items []interviewmodel.EvaluationWithAttempt
	for rows.Next() {
		var summary interviewmodel.EvaluationSummary
		var attempt interviewmodel.Attempt
		var status string
		var score decimalScan
		var sectionID string
		err := rows.Scan(
			&summary.ID, &summary.AttemptID, &score, &summary.Passed, &summary.Summary, &summary.Feedback,
			&summary.CreatedAt, &summary.UpdatedAt,
			&attempt.ID, &attempt.UserID, &attempt.SessionTaskID, &attempt.TaskID,
			&attempt.AnswerText, &attempt.Code, &attempt.Language, &attempt.Attachments,
			&status, &attempt.SubmittedAt, &attempt.CreatedAt, &attempt.UpdatedAt,
			&sectionID,
		)
		if err != nil {
			return nil, fmt.Errorf("scan evaluation: %w", err)
		}
		summary.Score = score.Decimal
		attempt.Status = interviewmodel.AttemptStatus(status)
		items = append(items, interviewmodel.EvaluationWithAttempt{
			Summary:   &summary,
			Attempt:   &attempt,
			TaskID:    attempt.TaskID,
			SectionID: sectionID,
		})
	}
	return items, rows.Err()
}

func scanAttempt(row pgx.Row) (*interviewmodel.Attempt, error) {
	var a interviewmodel.Attempt
	var status string
	err := row.Scan(
		&a.ID, &a.UserID, &a.SessionTaskID, &a.TaskID, &a.AnswerText, &a.Code, &a.Language,
		&a.Attachments, &status, &a.SubmittedAt, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan attempt: %w", err)
	}
	a.Status = interviewmodel.AttemptStatus(status)
	return &a, nil
}
