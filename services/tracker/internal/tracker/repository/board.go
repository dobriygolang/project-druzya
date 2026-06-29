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

func (r *Repository) ListProjectsByUser(ctx context.Context, userID string) ([]model.Project, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, user_id, name, position, created_at, updated_at
		FROM projects WHERE user_id = $1 ORDER BY position, created_at
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (r *Repository) GetProject(ctx context.Context, projectID, userID string) (*model.Project, error) {
	pid, err := uuid.Parse(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, name, position, created_at, updated_at
		FROM projects WHERE id = $1 AND user_id = $2
	`, pid, uid)
	p, err := scanProject(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return p, err
}

func (r *Repository) CreateProject(ctx context.Context, userID, name string) (*model.Project, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO projects (id, user_id, name, position)
		VALUES ($1, $2, $3, COALESCE((SELECT MAX(position)+1 FROM projects WHERE user_id = $2), 0))
		RETURNING id, user_id, name, position, created_at, updated_at
	`, id, uid, name)
	return scanProject(row)
}

func (r *Repository) ListEpicsByProject(ctx context.Context, projectID string) ([]model.Epic, error) {
	pid, err := uuid.Parse(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT e.id, e.project_id, e.name, e.position, e.status, e.hold_open, e.created_at, e.updated_at, e.completed_at,
		       COALESCE((SELECT COUNT(*)::int FROM tasks t
		                 JOIN sprints s ON s.id = t.sprint_id
		                 WHERE t.epic_id = e.id AND s.project_id = e.project_id
		                   AND NOT COALESCE((t.metadata->>'archived')::boolean, false)), 0),
		       COALESCE((SELECT COUNT(*)::int FROM tasks t
		                 JOIN sprints s ON s.id = t.sprint_id
		                 WHERE t.epic_id = e.id AND s.project_id = e.project_id AND t.done
		                   AND NOT COALESCE((t.metadata->>'archived')::boolean, false)), 0)
		FROM epics e WHERE e.project_id = $1 ORDER BY e.position, e.created_at
	`, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Epic
	for rows.Next() {
		e, err := scanEpic(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

func (r *Repository) CreateEpic(ctx context.Context, projectID, name string) (*model.Epic, error) {
	pid, err := uuid.Parse(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO epics (id, project_id, name, position)
		VALUES ($1, $2, $3, COALESCE((SELECT MAX(position)+1 FROM epics WHERE project_id = $2), 0))
		RETURNING id, project_id, name, position, status, created_at, updated_at, completed_at
	`, id, pid, name)
	return scanEpicBase(row)
}

func (r *Repository) FindEpicByName(ctx context.Context, projectID, name string) (*model.Epic, error) {
	pid, err := uuid.Parse(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, project_id, name, position, status, created_at, updated_at, completed_at
		FROM epics WHERE project_id = $1 AND lower(name) = lower($2)
		LIMIT 1
	`, pid, name)
	e, err := scanEpicBase(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return e, err
}

func (r *Repository) GetActiveSprint(ctx context.Context, projectID string) (*model.Sprint, error) {
	pid, err := uuid.Parse(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT s.id, s.project_id, s.name, s.goal, s.status, s.position, s.created_at, s.updated_at, s.archived_at,
		       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.done), 0),
		       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id), 0)
		FROM sprints s
		WHERE s.project_id = $1 AND s.status = 'active'
		ORDER BY s.position DESC, s.created_at DESC
		LIMIT 1
	`, pid)
	s, err := scanSprint(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return s, err
}

func (r *Repository) CreateSprint(ctx context.Context, projectID, name, goal string) (*model.Sprint, error) {
	pid, err := uuid.Parse(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	var sprint *model.Sprint
	err = r.WithTx(ctx, func(txCtx context.Context) error {
		if _, err := r.conn(txCtx).Exec(txCtx, `
			UPDATE sprints SET status = 'archived', archived_at = now(), updated_at = now()
			WHERE project_id = $1 AND status = 'active'
		`, pid); err != nil {
			return err
		}
		id, err := uuid.NewRandom()
		if err != nil {
			return err
		}
		row := r.conn(txCtx).QueryRow(txCtx, `
			INSERT INTO sprints (id, project_id, name, goal, status, position)
			VALUES ($1, $2, $3, $4, 'active', COALESCE((SELECT MAX(position)+1 FROM sprints WHERE project_id = $2), 0))
			RETURNING id, project_id, name, goal, status, position, created_at, updated_at, archived_at
		`, id, pid, name, goal)
		s, err := scanSprintBase(row)
		if err != nil {
			return err
		}
		sprint = s
		return nil
	})
	if err != nil {
		return nil, err
	}
	return sprint, nil
}

func (r *Repository) ArchiveSprint(ctx context.Context, sprintID, userID string) (*model.Sprint, error) {
	sid, err := uuid.Parse(sprintID)
	if err != nil {
		return nil, fmt.Errorf("invalid sprint_id: %w", err)
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		UPDATE sprints s SET status = 'archived', archived_at = now(), updated_at = now()
		FROM projects p
		WHERE s.id = $1 AND s.project_id = p.id AND p.user_id = $2
		RETURNING s.id, s.project_id, s.name, s.goal, s.status, s.position, s.created_at, s.updated_at, s.archived_at
	`, sid, uid)
	s, err := scanSprintBase(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *Repository) ListArchivedSprints(ctx context.Context, projectID string) ([]model.Sprint, error) {
	pid, err := uuid.Parse(projectID)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT s.id, s.project_id, s.name, s.goal, s.status, s.position, s.created_at, s.updated_at, s.archived_at,
		       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.done), 0),
		       COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id), 0)
		FROM sprints s
		WHERE s.project_id = $1 AND s.status = 'archived'
		ORDER BY s.archived_at DESC NULLS LAST, s.created_at DESC
	`, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Sprint
	for rows.Next() {
		s, err := scanSprint(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func (r *Repository) ListTasksBySprint(ctx context.Context, sprintID string) ([]model.Task, error) {
	sid, err := uuid.Parse(sprintID)
	if err != nil {
		return nil, fmt.Errorf("invalid sprint_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, sprint_id, epic_id, title, done, position, estimate_days, source, metadata, dedup_key, created_at, updated_at, completed_at
		FROM tasks WHERE sprint_id = $1 ORDER BY position, created_at
	`, sid)
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

func (r *Repository) CreateTask(ctx context.Context, in CreateTaskInput) (*model.Task, bool, error) {
	sid, err := uuid.Parse(in.SprintID)
	if err != nil {
		return nil, false, fmt.Errorf("invalid sprint_id: %w", err)
	}
	if in.DedupKey != nil && *in.DedupKey != "" {
		existing, err := r.findTaskByDedup(ctx, in.SprintID, *in.DedupKey)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return nil, false, err
		}
		if existing != nil {
			return existing, false, nil
		}
	}
	meta, err := json.Marshal(in.Metadata)
	if err != nil {
		return nil, false, err
	}
	id, err := uuid.NewRandom()
	if err != nil {
		return nil, false, err
	}
	var epicID *uuid.UUID
	if in.EpicID != nil && *in.EpicID != "" {
		parsed, err := uuid.Parse(*in.EpicID)
		if err != nil {
			return nil, false, fmt.Errorf("invalid epic_id: %w", err)
		}
		epicID = &parsed
	}
	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO tasks (id, sprint_id, epic_id, title, done, position, estimate_days, source, metadata, dedup_key)
		VALUES ($1, $2, $3, $4, false, COALESCE((SELECT MAX(position)+1 FROM tasks WHERE sprint_id = $2), 0), $5, $6, $7, $8)
		RETURNING id, sprint_id, epic_id, title, done, position, estimate_days, source, metadata, dedup_key, created_at, updated_at, completed_at
	`, id, sid, epicID, in.Title, in.EstimateDays, string(in.Source), meta, in.DedupKey)
	t, err := scanTask(row)
	if err != nil {
		return nil, false, err
	}
	return t, true, nil
}

func (r *Repository) findTaskByDedup(ctx context.Context, sprintID, dedupKey string) (*model.Task, error) {
	sid, err := uuid.Parse(sprintID)
	if err != nil {
		return nil, err
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, sprint_id, epic_id, title, done, position, estimate_days, source, metadata, dedup_key, created_at, updated_at, completed_at
		FROM tasks WHERE sprint_id = $1 AND dedup_key = $2
	`, sid, dedupKey)
	t, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return t, err
}

func (r *Repository) GetTask(ctx context.Context, taskID, userID string) (*model.Task, error) {
	tid, err := uuid.Parse(taskID)
	if err != nil {
		return nil, fmt.Errorf("invalid task_id: %w", err)
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT t.id, t.sprint_id, t.epic_id, t.title, t.done, t.position, t.estimate_days, t.source, t.metadata, t.dedup_key, t.created_at, t.updated_at, t.completed_at
		FROM tasks t
		JOIN sprints s ON s.id = t.sprint_id
		JOIN projects p ON p.id = s.project_id
		WHERE t.id = $1 AND p.user_id = $2
	`, tid, uid)
	task, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return task, err
}

func (r *Repository) UpdateTask(ctx context.Context, taskID, userID string, patch TaskPatch) (*model.Task, error) {
	current, err := r.GetTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	title := current.Title
	if patch.Title != nil {
		title = *patch.Title
	}
	done := current.Done
	if patch.Done != nil {
		done = *patch.Done
	}
	epicID := current.EpicID
	if patch.EpicID != nil {
		if *patch.EpicID == "" {
			epicID = nil
		} else {
			epicID = patch.EpicID
		}
	}
	position := current.Position
	if patch.Position != nil {
		position = *patch.Position
	}
	estimateDays := current.EstimateDays
	if patch.EstimateDays != nil {
		estimateDays = *patch.EstimateDays
	}
	var epicUUID *uuid.UUID
	if epicID != nil && *epicID != "" {
		parsed, err := uuid.Parse(*epicID)
		if err != nil {
			return nil, fmt.Errorf("invalid epic_id: %w", err)
		}
		epicUUID = &parsed
	}
	tid, _ := uuid.Parse(taskID)
	var completedAt *time.Time
	if done && !current.Done {
		now := time.Now().UTC()
		completedAt = &now
	} else if !done {
		completedAt = nil
	} else {
		completedAt = current.CompletedAt
	}
	row := r.conn(ctx).QueryRow(ctx, `
		UPDATE tasks SET title = $2, done = $3, epic_id = $4, position = $5, estimate_days = $6, completed_at = $7, updated_at = now()
		WHERE id = $1
		RETURNING id, sprint_id, epic_id, title, done, position, estimate_days, source, metadata, dedup_key, created_at, updated_at, completed_at
	`, tid, title, done, epicUUID, position, estimateDays, completedAt)
	return scanTask(row)
}

type CreateTaskInput struct {
	SprintID     string
	EpicID       *string
	Title        string
	EstimateDays float64
	Source       model.TaskSource
	Metadata     map[string]any
	DedupKey     *string
}

type TaskPatch struct {
	Title        *string
	Done         *bool
	EpicID       *string
	Position     *int
	EstimateDays *float64
}

func scanProject(row pgx.Row) (*model.Project, error) {
	var p model.Project
	var id, userID uuid.UUID
	if err := row.Scan(&id, &userID, &p.Name, &p.Position, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, err
	}
	p.ID = id.String()
	p.UserID = userID.String()
	return &p, nil
}

func scanEpic(row pgx.Row) (*model.Epic, error) {
	var e model.Epic
	var id, projectID uuid.UUID
	var status string
	if err := row.Scan(&id, &projectID, &e.Name, &e.Position, &status, &e.HoldOpen, &e.CreatedAt, &e.UpdatedAt, &e.CompletedAt, &e.TotalCount, &e.DoneCount); err != nil {
		return nil, err
	}
	e.ID = id.String()
	e.ProjectID = projectID.String()
	e.Status = model.EpicStatus(status)
	return &e, nil
}

func scanEpicBase(row pgx.Row) (*model.Epic, error) {
	var e model.Epic
	var id, projectID uuid.UUID
	var status string
	if err := row.Scan(&id, &projectID, &e.Name, &e.Position, &status, &e.CreatedAt, &e.UpdatedAt, &e.CompletedAt); err != nil {
		return nil, err
	}
	e.ID = id.String()
	e.ProjectID = projectID.String()
	e.Status = model.EpicStatus(status)
	return &e, nil
}

func scanSprintBase(row pgx.Row) (*model.Sprint, error) {
	var s model.Sprint
	var id, projectID uuid.UUID
	var status string
	if err := row.Scan(&id, &projectID, &s.Name, &s.Goal, &status, &s.Position, &s.CreatedAt, &s.UpdatedAt, &s.ArchivedAt); err != nil {
		return nil, err
	}
	s.ID = id.String()
	s.ProjectID = projectID.String()
	s.Status = model.SprintStatus(status)
	return &s, nil
}

func scanSprint(row pgx.Row) (*model.Sprint, error) {
	var s model.Sprint
	var id, projectID uuid.UUID
	var status string
	if err := row.Scan(&id, &projectID, &s.Name, &s.Goal, &status, &s.Position, &s.CreatedAt, &s.UpdatedAt, &s.ArchivedAt, &s.DoneCount, &s.TotalCount); err != nil {
		return nil, err
	}
	s.ID = id.String()
	s.ProjectID = projectID.String()
	s.Status = model.SprintStatus(status)
	return &s, nil
}

func scanTask(row pgx.Row) (*model.Task, error) {
	var t model.Task
	var id, sprintID uuid.UUID
	var epicID *uuid.UUID
	var source string
	var meta []byte
	var dedup *string
	if err := row.Scan(&id, &sprintID, &epicID, &t.Title, &t.Done, &t.Position, &t.EstimateDays, &source, &meta, &dedup, &t.CreatedAt, &t.UpdatedAt, &t.CompletedAt); err != nil {
		return nil, err
	}
	t.ID = id.String()
	t.SprintID = sprintID.String()
	if epicID != nil {
		s := epicID.String()
		t.EpicID = &s
	}
	t.Source = model.TaskSource(source)
	t.DedupKey = dedup
	if len(meta) > 0 {
		_ = json.Unmarshal(meta, &t.Metadata)
	}
	if t.Metadata == nil {
		t.Metadata = map[string]any{}
	}
	return &t, nil
}
