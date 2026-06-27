package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

var ErrNotFound = errors.New("code run not found")

// Repository persists sandbox code runs.
type Repository struct {
	pg *Pool
}

// New constructs a sandbox repository.
func New(pg *Pool) *Repository {
	return &Repository{pg: pg}
}

// ListFilter filters code runs for a user.
type ListFilter struct {
	UserID        string
	TaskID        *string
	SessionTaskID *string
	Limit         int
}

// Create inserts a new code run.
func (r *Repository) Create(ctx context.Context, run *model.CodeRun) error {
	userID, err := uuid.Parse(run.UserID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	runID, err := uuid.Parse(run.ID)
	if err != nil {
		return fmt.Errorf("invalid run id: %w", err)
	}

	testResults, err := json.Marshal(run.TestResults)
	if err != nil {
		return fmt.Errorf("marshal test_results: %w", err)
	}

	var taskID, sessionTaskID *uuid.UUID
	if run.TaskID != nil && *run.TaskID != "" {
		id, err := uuid.Parse(*run.TaskID)
		if err != nil {
			return fmt.Errorf("invalid task_id: %w", err)
		}
		taskID = &id
	}
	if run.SessionTaskID != nil && *run.SessionTaskID != "" {
		id, err := uuid.Parse(*run.SessionTaskID)
		if err != nil {
			return fmt.Errorf("invalid session_task_id: %w", err)
		}
		sessionTaskID = &id
	}

	_, err = r.pg.Exec(ctx, `
		INSERT INTO code_runs (
			id, user_id, task_id, session_task_id, language, code, stdin, status, run_type,
			stdout, stderr, compile_output, error, exit_code, time_ms, memory_kb,
			tests_total, tests_passed, test_results, runner, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9,
			$10, $11, $12, $13, $14, $15, $16,
			$17, $18, $19, $20, $21, $22
		)
	`, runID, userID, taskID, sessionTaskID, run.Language, run.Code, run.Stdin, run.Status, run.RunType,
		run.Stdout, run.Stderr, run.CompileOutput, run.Error, run.ExitCode, run.TimeMS, run.MemoryKB,
		run.TestsTotal, run.TestsPassed, testResults, run.Runner, run.CreatedAt, run.UpdatedAt)
	return err
}

// Update replaces execution result fields.
func (r *Repository) Update(ctx context.Context, run *model.CodeRun) error {
	runID, err := uuid.Parse(run.ID)
	if err != nil {
		return fmt.Errorf("invalid run id: %w", err)
	}
	testResults, err := json.Marshal(run.TestResults)
	if err != nil {
		return fmt.Errorf("marshal test_results: %w", err)
	}
	tag, err := r.pg.Exec(ctx, `
		UPDATE code_runs SET
			status = $2, stdout = $3, stderr = $4, compile_output = $5, error = $6,
			exit_code = $7, time_ms = $8, memory_kb = $9,
			tests_total = $10, tests_passed = $11, test_results = $12,
			runner = $13, updated_at = $14
		WHERE id = $1
	`, runID, run.Status, run.Stdout, run.Stderr, run.CompileOutput, run.Error,
		run.ExitCode, run.TimeMS, run.MemoryKB,
		run.TestsTotal, run.TestsPassed, testResults, run.Runner, run.UpdatedAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetByID loads a code run by id.
func (r *Repository) GetByID(ctx context.Context, id string) (*model.CodeRun, error) {
	runID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid run id: %w", err)
	}
	return r.scanOne(r.pg.QueryRow(ctx, `
		SELECT id, user_id, task_id, session_task_id, language, code, stdin, status, run_type,
			stdout, stderr, compile_output, error, exit_code, time_ms, memory_kb,
			tests_total, tests_passed, test_results, runner, created_at, updated_at
		FROM code_runs WHERE id = $1
	`, runID))
}

// List returns recent runs for a user.
func (r *Repository) List(ctx context.Context, filter ListFilter) ([]model.CodeRun, error) {
	userID, err := uuid.Parse(filter.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT id, user_id, task_id, session_task_id, language, code, stdin, status, run_type,
			stdout, stderr, compile_output, error, exit_code, time_ms, memory_kb,
			tests_total, tests_passed, test_results, runner, created_at, updated_at
		FROM code_runs
		WHERE user_id = $1`
	args := []any{userID}
	argN := 2
	if filter.TaskID != nil && *filter.TaskID != "" {
		taskID, err := uuid.Parse(*filter.TaskID)
		if err != nil {
			return nil, fmt.Errorf("invalid task_id: %w", err)
		}
		query += fmt.Sprintf(" AND task_id = $%d", argN)
		args = append(args, taskID)
		argN++
	}
	if filter.SessionTaskID != nil && *filter.SessionTaskID != "" {
		sessionTaskID, err := uuid.Parse(*filter.SessionTaskID)
		if err != nil {
			return nil, fmt.Errorf("invalid session_task_id: %w", err)
		}
		query += fmt.Sprintf(" AND session_task_id = $%d", argN)
		args = append(args, sessionTaskID)
		argN++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argN)
	args = append(args, limit)

	rows, err := r.pg.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.CodeRun, 0, limit)
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *run)
	}
	return out, rows.Err()
}

// ClaimQueuedRuns atomically claims queued runs for background execution.
func (r *Repository) ClaimQueuedRuns(ctx context.Context, limit int) ([]model.CodeRun, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	rows, err := r.pg.Query(ctx, `
		UPDATE code_runs SET status = $2, updated_at = now()
		WHERE id IN (
			SELECT id FROM code_runs
			WHERE status = $1
			ORDER BY created_at ASC
			LIMIT $3
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, user_id, task_id, session_task_id, language, code, stdin, status, run_type,
			stdout, stderr, compile_output, error, exit_code, time_ms, memory_kb,
			tests_total, tests_passed, test_results, runner, created_at, updated_at
	`, model.StatusQueued, model.StatusRunning, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.CodeRun, 0, limit)
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *run)
	}
	return out, rows.Err()
}

type rowScanner interface {
	Scan(dest ...any) error
}

func (r *Repository) scanOne(row rowScanner) (*model.CodeRun, error) {
	run, err := scanRun(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return run, err
}

func scanRun(row rowScanner) (*model.CodeRun, error) {
	var run model.CodeRun
	var id, userID uuid.UUID
	var taskID, sessionTaskID *uuid.UUID
	var testResultsJSON []byte
	if err := row.Scan(
		&id, &userID, &taskID, &sessionTaskID, &run.Language, &run.Code, &run.Stdin, &run.Status, &run.RunType,
		&run.Stdout, &run.Stderr, &run.CompileOutput, &run.Error, &run.ExitCode, &run.TimeMS, &run.MemoryKB,
		&run.TestsTotal, &run.TestsPassed, &testResultsJSON, &run.Runner, &run.CreatedAt, &run.UpdatedAt,
	); err != nil {
		return nil, err
	}
	run.ID = id.String()
	run.UserID = userID.String()
	if taskID != nil {
		s := taskID.String()
		run.TaskID = &s
	}
	if sessionTaskID != nil {
		s := sessionTaskID.String()
		run.SessionTaskID = &s
	}
	if len(testResultsJSON) > 0 {
		_ = json.Unmarshal(testResultsJSON, &run.TestResults)
	}
	if run.TestResults == nil {
		run.TestResults = []model.TestResult{}
	}
	return &run, nil
}

// TouchUpdatedAt returns current UTC time for updates.
func TouchUpdatedAt() time.Time {
	return time.Now().UTC()
}
