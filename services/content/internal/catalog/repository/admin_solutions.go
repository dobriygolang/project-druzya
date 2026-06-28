package repository

import (
	"context"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// ReplaceTaskSolutions replaces all reference solutions for a task atomically.
func (r *Repository) ReplaceTaskSolutions(
	ctx context.Context,
	taskID string,
	solutions []catalogmodel.Solution,
) ([]catalogmodel.Solution, error) {
	tx, err := r.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1::uuid)`, taskID).Scan(&exists); err != nil {
		return nil, fmt.Errorf("check task: %w", err)
	}
	if !exists {
		return nil, ErrNotFound
	}

	if _, err := tx.Exec(ctx, `DELETE FROM task_solutions WHERE task_id = $1::uuid`, taskID); err != nil {
		return nil, fmt.Errorf("delete solutions: %w", err)
	}

	out := make([]catalogmodel.Solution, 0, len(solutions))
	for _, sol := range solutions {
		if sol.SolutionText == "" {
			continue
		}
		row := tx.QueryRow(ctx, `
			INSERT INTO task_solutions (id, task_id, language, solution_text, explanation, complexity, is_primary)
			VALUES (
				COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()),
				$2::uuid, $3, $4, $5, $6, $7
			)
			RETURNING id, task_id, language, solution_text, explanation, complexity, is_primary, created_at, updated_at
		`, nullUUID(sol.ID), taskID, sol.Language, sol.SolutionText, sol.Explanation, sol.Complexity, sol.IsPrimary)
		item, err := scanSolution(row)
		if err != nil {
			return nil, fmt.Errorf("insert solution: %w", err)
		}
		out = append(out, *item)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}
	return out, nil
}
