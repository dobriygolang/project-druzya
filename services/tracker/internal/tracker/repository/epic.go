package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

const taskNotArchivedSQL = `NOT COALESCE((t.metadata->>'archived')::boolean, false)`

func (r *Repository) SumEstimateDaysBySprint(ctx context.Context, sprintID string, excludeTaskID *string) (float64, error) {
	sid, err := uuid.Parse(sprintID)
	if err != nil {
		return 0, fmt.Errorf("invalid sprint_id: %w", err)
	}
	var exclude *uuid.UUID
	if excludeTaskID != nil && *excludeTaskID != "" {
		parsed, err := uuid.Parse(*excludeTaskID)
		if err != nil {
			return 0, fmt.Errorf("invalid task_id: %w", err)
		}
		exclude = &parsed
	}
	var sum float64
	err = r.conn(ctx).QueryRow(ctx, `
		SELECT COALESCE(SUM(t.estimate_days), 0)
		FROM tasks t
		WHERE t.sprint_id = $1
		  AND `+taskNotArchivedSQL+`
		  AND ($2::uuid IS NULL OR t.id <> $2)
	`, sid, exclude).Scan(&sum)
	return sum, err
}

func (r *Repository) SyncEpicStatus(ctx context.Context, epicID string) error {
	if epicID == "" {
		return nil
	}
	eid, err := uuid.Parse(epicID)
	if err != nil {
		return fmt.Errorf("invalid epic_id: %w", err)
	}
	var holdOpen bool
	err = r.conn(ctx).QueryRow(ctx, `SELECT hold_open FROM epics WHERE id = $1`, eid).Scan(&holdOpen)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	var total, done int
	err = r.conn(ctx).QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			COUNT(*) FILTER (WHERE t.done)::int
		FROM tasks t
		WHERE t.epic_id = $1
		  AND `+taskNotArchivedSQL+`
	`, eid).Scan(&total, &done)
	if err != nil {
		return err
	}
	if total == 0 {
		_, err = r.conn(ctx).Exec(ctx, `
			UPDATE epics SET status = $2, hold_open = false, completed_at = NULL, updated_at = now()
			WHERE id = $1
		`, eid, model.EpicStatusOpen)
		return err
	}
	if done < total {
		_, err = r.conn(ctx).Exec(ctx, `
			UPDATE epics SET status = $2, hold_open = false, completed_at = NULL, updated_at = now()
			WHERE id = $1
		`, eid, model.EpicStatusOpen)
		return err
	}
	if holdOpen {
		_, err = r.conn(ctx).Exec(ctx, `
			UPDATE epics SET status = $2, completed_at = NULL, updated_at = now()
			WHERE id = $1
		`, eid, model.EpicStatusOpen)
		return err
	}
	_, err = r.conn(ctx).Exec(ctx, `
		UPDATE epics SET status = $2, hold_open = false, completed_at = now(), updated_at = now()
		WHERE id = $1
	`, eid, model.EpicStatusDone)
	return err
}

func (r *Repository) ReopenEpic(ctx context.Context, epicID, userID string) (*model.Epic, error) {
	eid, err := uuid.Parse(epicID)
	if err != nil {
		return nil, fmt.Errorf("invalid epic_id: %w", err)
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		UPDATE epics e SET status = 'open', hold_open = true, completed_at = NULL, updated_at = now()
		FROM projects p
		WHERE e.id = $1 AND e.project_id = p.id AND p.user_id = $2
		RETURNING e.id, e.project_id, e.name, e.position, e.status, e.created_at, e.updated_at, e.completed_at
	`, eid, uid)
	epic, err := scanEpicBase(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return epic, err
}
