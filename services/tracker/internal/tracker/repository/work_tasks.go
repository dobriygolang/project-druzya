package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

type WorkTaskPatch struct {
	Title                *string
	BoardStatus          *string
	Done                 *bool
	Metadata             map[string]any
	ScheduledStart       *time.Time
	ScheduledDurationMin *int
	ClearSchedule        bool
	Archived             bool
}

func (r *Repository) ListWorkTasksByUser(ctx context.Context, userID string) ([]model.Task, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT `+taskSelectCols+`
		FROM tasks t
		JOIN sprints s ON s.id = t.sprint_id
		JOIN projects p ON p.id = s.project_id
		WHERE p.user_id = $1 AND s.status = 'active' AND t.archived_at IS NULL
		ORDER BY t.position, t.created_at
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

func (r *Repository) PatchWorkTask(ctx context.Context, taskID, userID string, patch WorkTaskPatch) (*model.Task, error) {
	current, err := r.GetTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}

	title := current.Title
	if patch.Title != nil {
		title = *patch.Title
	}
	boardStatus := current.BoardStatus
	if patch.BoardStatus != nil {
		boardStatus = *patch.BoardStatus
	}
	done := current.Done
	if patch.Done != nil {
		done = *patch.Done
	} else if boardStatus == "done" {
		done = true
	} else if boardStatus == "todo" || boardStatus == "in_progress" || boardStatus == "in_review" {
		done = false
	}

	meta := current.Metadata
	if patch.Metadata != nil {
		meta = mergeTaskMetadata(meta, patch.Metadata)
	}
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return nil, err
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

	var completedAt *time.Time
	if done && !current.Done {
		now := time.Now().UTC()
		completedAt = &now
	} else if !done {
		completedAt = nil
	} else {
		completedAt = current.CompletedAt
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
		UPDATE tasks
		SET title = $2, done = $3, board_status = $4, metadata = $5,
		    scheduled_start = $6, scheduled_duration_min = $7, archived_at = $8,
		    completed_at = $9, updated_at = now()
		WHERE id = $1
		RETURNING `+taskReturningCols+`
	`, tid, title, done, boardStatus, metaBytes, scheduledStart, scheduledDur, archivedAt, completedAt)
	task, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return task, err
}

func (r *Repository) CreateWorkTask(ctx context.Context, sprintID, userID, title string, meta map[string]any, boardStatus string) (*model.Task, error) {
	sid, err := uuid.Parse(sprintID)
	if err != nil {
		return nil, fmt.Errorf("invalid sprint_id: %w", err)
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	var ok bool
	if err := r.conn(ctx).QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM sprints s JOIN projects p ON p.id = s.project_id
			WHERE s.id = $1 AND p.user_id = $2 AND s.status = 'active'
		)
	`, sid, uid).Scan(&ok); err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}
	if boardStatus == "" {
		boardStatus = "todo"
	}
	if meta == nil {
		meta = map[string]any{}
	}
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return nil, err
	}
	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO tasks (id, sprint_id, title, done, position, estimate_days, source, metadata, board_status)
		VALUES ($1, $2, $3, false, COALESCE((SELECT MAX(position)+1 FROM tasks WHERE sprint_id = $2), 0), $4, $5, $6, $7)
		RETURNING `+taskReturningCols+`
	`, id, sid, title, model.DefaultTaskEstimateDays, string(model.TaskSourceUser), metaBytes, boardStatus)
	return scanTask(row)
}
