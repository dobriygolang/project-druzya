package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// SessionBundle is inserted atomically when a session starts.
type SessionBundle struct {
	Session  interviewmodel.Session
	Sections []interviewmodel.SessionSection
	Tasks    []interviewmodel.SessionTask
}

func (r *Repository) CreateSessionBundle(ctx context.Context, bundle SessionBundle) error {
	return r.WithTx(ctx, func(txCtx context.Context) error {
		return r.insertSessionBundle(txCtx, bundle)
	})
}

func (r *Repository) insertSessionBundle(ctx context.Context, bundle SessionBundle) error {
	s := bundle.Session
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO interview_sessions (
			id, user_id, template_id, mode, status, started_at, completed_at,
			passing_score, total_score, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, s.ID, s.UserID, s.TemplateID, string(s.Mode), string(s.Status), s.StartedAt, s.CompletedAt,
		s.PassingScore, decimalPtrToNumeric(s.TotalScore), s.CreatedAt, s.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrActiveSessionExists
		}
		return fmt.Errorf("insert session: %w", err)
	}

	for _, sec := range bundle.Sections {
		_, err = r.conn(ctx).Exec(ctx, `
			INSERT INTO interview_session_sections (
				id, session_id, section_type, title, position, status,
				passing_score, score, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, sec.ID, sec.SessionID, sec.SectionType, sec.Title, sec.Position, string(sec.Status),
			sec.PassingScore, decimalPtrToNumeric(sec.Score), sec.CreatedAt, sec.UpdatedAt)
		if err != nil {
			return fmt.Errorf("insert section: %w", err)
		}
	}

	for _, task := range bundle.Tasks {
		_, err = r.conn(ctx).Exec(ctx, `
			INSERT INTO session_tasks (
				id, session_id, section_id, task_id, task_title, task_type,
				position, status, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		`, task.ID, task.SessionID, task.SectionID, task.TaskID, task.TaskTitle, task.TaskType,
			task.Position, string(task.Status), task.CreatedAt, task.UpdatedAt)
		if err != nil {
			return fmt.Errorf("insert session task: %w", err)
		}
	}

	return nil
}

func (r *Repository) GetSessionByID(ctx context.Context, id string) (*interviewmodel.Session, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, template_id, mode, status, started_at, completed_at,
		       passing_score, total_score, created_at, updated_at
		FROM interview_sessions WHERE id = $1
	`, id)
	return scanSession(row)
}

func (r *Repository) GetSessionForUser(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, template_id, mode, status, started_at, completed_at,
		       passing_score, total_score, created_at, updated_at
		FROM interview_sessions WHERE id = $1 AND user_id = $2
	`, sessionID, userID)
	return scanSession(row)
}

func (r *Repository) GetActiveSessionForUser(ctx context.Context, userID string) (*interviewmodel.Session, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, template_id, mode, status, started_at, completed_at,
		       passing_score, total_score, created_at, updated_at
		FROM interview_sessions
		WHERE user_id = $1 AND status = 'active'
		LIMIT 1
	`, userID)
	return scanSession(row)
}

func (r *Repository) ExpireStaleActiveSessions(ctx context.Context, idleBefore, maxAgeBefore time.Time) (int64, error) {
	tag, err := r.conn(ctx).Exec(ctx, `
		UPDATE interview_sessions
		SET status = 'expired', updated_at = now()
		WHERE status = 'active'
		  AND (updated_at < $1 OR started_at < $2)
	`, idleBefore, maxAgeBefore)
	if err != nil {
		return 0, fmt.Errorf("expire stale sessions: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) UpdateSession(ctx context.Context, session *interviewmodel.Session) error {
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE interview_sessions
		SET status = $2, completed_at = $3, total_score = $4, updated_at = $5
		WHERE id = $1
	`, session.ID, string(session.Status), session.CompletedAt, decimalPtrToNumeric(session.TotalScore), session.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update session: %w", err)
	}
	return nil
}

func (r *Repository) ListSectionsBySession(ctx context.Context, sessionID string) ([]interviewmodel.SessionSection, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, session_id, section_type, title, position, status,
		       passing_score, score, created_at, updated_at
		FROM interview_session_sections
		WHERE session_id = $1
		ORDER BY position
	`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("list sections: %w", err)
	}
	defer rows.Close()

	var items []interviewmodel.SessionSection
	for rows.Next() {
		item, err := scanSection(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) UpdateSection(ctx context.Context, section *interviewmodel.SessionSection) error {
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE interview_session_sections
		SET status = $2, score = $3, updated_at = $4
		WHERE id = $1
	`, section.ID, string(section.Status), decimalPtrToNumeric(section.Score), section.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update section: %w", err)
	}
	return nil
}

func (r *Repository) ListTasksBySession(ctx context.Context, sessionID string) ([]interviewmodel.SessionTask, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, session_id, section_id, task_id, task_title, task_type, position, status, created_at, updated_at
		FROM session_tasks
		WHERE session_id = $1
		ORDER BY section_id, position
	`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("list session tasks: %w", err)
	}
	defer rows.Close()

	var items []interviewmodel.SessionTask
	for rows.Next() {
		item, err := scanSessionTask(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetSessionTaskByID(ctx context.Context, id string) (*interviewmodel.SessionTask, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, session_id, section_id, task_id, task_title, task_type, position, status, created_at, updated_at
		FROM session_tasks WHERE id = $1
	`, id)
	return scanSessionTask(row)
}

func (r *Repository) GetSessionTaskForUser(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SessionTask, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT st.id, st.session_id, st.section_id, st.task_id, st.task_title, st.task_type,
		       st.position, st.status, st.created_at, st.updated_at
		FROM session_tasks st
		JOIN interview_sessions s ON s.id = st.session_id
		WHERE st.id = $1 AND s.user_id = $2
	`, sessionTaskID, userID)
	return scanSessionTask(row)
}

func (r *Repository) UpdateSessionTask(ctx context.Context, task *interviewmodel.SessionTask) error {
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE session_tasks SET status = $2, updated_at = $3 WHERE id = $1
	`, task.ID, string(task.Status), task.UpdatedAt)
	if err != nil {
		return fmt.Errorf("update session task: %w", err)
	}
	return nil
}

func scanSession(row pgx.Row) (*interviewmodel.Session, error) {
	var s interviewmodel.Session
	var mode, status string
	var totalScore *decimal.Decimal
	err := row.Scan(
		&s.ID, &s.UserID, &s.TemplateID, &mode, &status, &s.StartedAt, &s.CompletedAt,
		&s.PassingScore, &totalScore, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan session: %w", err)
	}
	s.Mode = interviewmodel.SessionMode(mode)
	s.Status = interviewmodel.SessionStatus(status)
	s.TotalScore = totalScore
	return &s, nil
}

func scanSection(row pgx.Row) (*interviewmodel.SessionSection, error) {
	var s interviewmodel.SessionSection
	var status string
	var score *decimal.Decimal
	err := row.Scan(
		&s.ID, &s.SessionID, &s.SectionType, &s.Title, &s.Position, &status,
		&s.PassingScore, &score, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan section: %w", err)
	}
	s.Status = interviewmodel.SectionStatus(status)
	s.Score = score
	return &s, nil
}

func scanSessionTask(row pgx.Row) (*interviewmodel.SessionTask, error) {
	var t interviewmodel.SessionTask
	var status string
	err := row.Scan(
		&t.ID, &t.SessionID, &t.SectionID, &t.TaskID, &t.TaskTitle, &t.TaskType,
		&t.Position, &status, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan session task: %w", err)
	}
	t.Status = interviewmodel.SessionTaskStatus(status)
	return &t, nil
}

func decimalPtrToNumeric(v *decimal.Decimal) any {
	if v == nil {
		return nil
	}
	return v.String()
}
