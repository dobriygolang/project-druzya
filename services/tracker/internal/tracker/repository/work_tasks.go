package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

const workTaskSelectCols = `id, user_id, status, kind, title, created_at, updated_at, completed_at,
	scheduled_start, scheduled_duration_min, google_event_id, archived_at`

type WorkTaskPatch struct {
	Title                *string
	Status               *string
	Kind                 *string
	Done                 *bool
	ScheduledStart       *time.Time
	ScheduledDurationMin *int
	GoogleEventID        *string
	ClearSchedule        bool
	ClearGoogleEventID   bool
	Archived             bool
}

func (r *Repository) ListWorkTasksByUser(ctx context.Context, userID string) ([]model.WorkTask, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT `+workTaskSelectCols+`
		FROM work_tasks
		WHERE user_id = $1 AND archived_at IS NULL
		ORDER BY updated_at DESC, created_at DESC
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.WorkTask
	for rows.Next() {
		t, err := scanWorkTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

func (r *Repository) GetWorkTask(ctx context.Context, taskID, userID string) (*model.WorkTask, error) {
	tid, err := uuid.Parse(taskID)
	if err != nil {
		return nil, fmt.Errorf("invalid task_id: %w", err)
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT `+workTaskSelectCols+`
		FROM work_tasks WHERE id = $1 AND user_id = $2
	`, tid, uid)
	task, err := scanWorkTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return task, err
}

func (r *Repository) CreateWorkTask(ctx context.Context, userID, kind, title, status string) (*model.WorkTask, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	if status == "" {
		status = "todo"
	}
	if kind == "" {
		kind = "custom"
	}
	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO work_tasks (id, user_id, status, kind, title)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+workTaskSelectCols+`
	`, id, uid, status, kind, title)
	return scanWorkTask(row)
}

func (r *Repository) PatchWorkTask(ctx context.Context, taskID, userID string, patch WorkTaskPatch) (*model.WorkTask, error) {
	current, err := r.GetWorkTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}

	title := current.Title
	if patch.Title != nil {
		title = *patch.Title
	}
	status := current.Status
	if patch.Status != nil {
		status = *patch.Status
	}
	kind := current.Kind
	if patch.Kind != nil {
		kind = *patch.Kind
	}

	completedAt := current.CompletedAt
	if patch.Done != nil {
		if *patch.Done && current.CompletedAt == nil {
			now := time.Now().UTC()
			completedAt = &now
		}
		if !*patch.Done {
			completedAt = nil
		}
	} else if patch.Status != nil {
		switch *patch.Status {
		case "done":
			if current.CompletedAt == nil {
				now := time.Now().UTC()
				completedAt = &now
			}
		case "todo", "in_progress", "in_review", "dismissed":
			completedAt = nil
		}
	}

	scheduledStart := current.ScheduledStart
	scheduledDur := current.ScheduledDurationMin
	if patch.ClearSchedule {
		scheduledStart = nil
		scheduledDur = nil
	}
	if patch.ScheduledStart != nil {
		scheduledStart = patch.ScheduledStart
	}
	if patch.ScheduledDurationMin != nil {
		scheduledDur = patch.ScheduledDurationMin
	}

	googleEventID := current.GoogleEventID
	if patch.ClearGoogleEventID {
		googleEventID = nil
	}
	if patch.GoogleEventID != nil {
		googleEventID = patch.GoogleEventID
	}

	var archivedAt *time.Time
	if patch.Archived {
		now := time.Now().UTC()
		archivedAt = &now
	} else {
		archivedAt = current.ArchivedAt
	}

	tid, _ := uuid.Parse(taskID)
	row := r.conn(ctx).QueryRow(ctx, `
		UPDATE work_tasks
		SET title = $2, status = $3, kind = $4, completed_at = $5,
		    scheduled_start = $6, scheduled_duration_min = $7, google_event_id = $8,
		    archived_at = $9, updated_at = now()
		WHERE id = $1
		RETURNING `+workTaskSelectCols+`
	`, tid, title, status, kind, completedAt, scheduledStart, scheduledDur, googleEventID, archivedAt)
	task, err := scanWorkTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return task, err
}

func scanWorkTask(row pgx.Row) (*model.WorkTask, error) {
	var t model.WorkTask
	var uid uuid.UUID
	var googleEventID *string
	err := row.Scan(
		&t.ID, &uid, &t.Status, &t.Kind, &t.Title,
		&t.CreatedAt, &t.UpdatedAt, &t.CompletedAt,
		&t.ScheduledStart, &t.ScheduledDurationMin, &googleEventID, &t.ArchivedAt,
	)
	if err != nil {
		return nil, err
	}
	t.UserID = uid.String()
	t.GoogleEventID = googleEventID
	return &t, nil
}
