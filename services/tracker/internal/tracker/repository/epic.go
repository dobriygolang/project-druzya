package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
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
	status := model.EpicStatusOpen
	if total > 0 && done == total {
		status = model.EpicStatusDone
		_, err = r.conn(ctx).Exec(ctx, `
			UPDATE epics SET status = $2, completed_at = now(), updated_at = now()
			WHERE id = $1
		`, eid, status)
		return err
	}
	_, err = r.conn(ctx).Exec(ctx, `
		UPDATE epics SET status = $2, completed_at = NULL, updated_at = now()
		WHERE id = $1
	`, eid, status)
	return err
}
