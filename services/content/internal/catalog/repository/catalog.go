package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// ListCompaniesFilter filters company list queries.
type ListCompaniesFilter struct {
	ActiveOnly bool
	Limit      int
	Offset     int
}

func (r *Repository) ListCompanies(ctx context.Context, f ListCompaniesFilter) ([]catalogmodel.Company, error) {
	query := `
		SELECT id, slug, name, description, is_active, created_at, updated_at
		FROM companies
		WHERE ($1 = false OR is_active = true)
		ORDER BY name
		LIMIT $2 OFFSET $3
	`
	rows, err := r.pg.Query(ctx, query, f.ActiveOnly, f.Limit, f.Offset)
	if err != nil {
		return nil, fmt.Errorf("list companies: %w", err)
	}
	defer rows.Close()

	var items []catalogmodel.Company
	for rows.Next() {
		item, err := scanCompany(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetCompanyByID(ctx context.Context, id string) (*catalogmodel.Company, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, name, description, is_active, created_at, updated_at
		FROM companies WHERE id = $1
	`, id)
	return scanCompany(row)
}

func (r *Repository) GetCompanyBySlug(ctx context.Context, slug string) (*catalogmodel.Company, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, name, description, is_active, created_at, updated_at
		FROM companies WHERE slug = $1
	`, slug)
	return scanCompany(row)
}

func scanCompany(row pgx.Row) (*catalogmodel.Company, error) {
	var c catalogmodel.Company
	err := row.Scan(&c.ID, &c.Slug, &c.Name, &c.Description, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan company: %w", err)
	}
	return &c, nil
}

// ListTemplatesFilter filters template list queries.
type ListTemplatesFilter struct {
	CompanyID  *string
	ActiveOnly bool
	Limit      int
	Offset     int
}

func (r *Repository) ListInterviewTemplates(ctx context.Context, f ListTemplatesFilter) ([]catalogmodel.InterviewTemplate, error) {
	query := `
		SELECT id, company_id, slug, title, description, target_role, target_level,
		       passing_score, is_active, created_at, updated_at
		FROM interview_templates
		WHERE ($1::uuid IS NULL OR company_id = $1)
		  AND ($2 = false OR is_active = true)
		ORDER BY title
		LIMIT $3 OFFSET $4
	`
	rows, err := r.pg.Query(ctx, query, f.CompanyID, f.ActiveOnly, f.Limit, f.Offset)
	if err != nil {
		return nil, fmt.Errorf("list templates: %w", err)
	}
	defer rows.Close()

	var items []catalogmodel.InterviewTemplate
	for rows.Next() {
		item, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetInterviewTemplateByID(ctx context.Context, id string) (*catalogmodel.InterviewTemplate, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, company_id, slug, title, description, target_role, target_level,
		       passing_score, is_active, created_at, updated_at
		FROM interview_templates WHERE id = $1
	`, id)
	return scanTemplate(row)
}

func (r *Repository) GetInterviewTemplateBySlug(ctx context.Context, slug string) (*catalogmodel.InterviewTemplate, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, company_id, slug, title, description, target_role, target_level,
		       passing_score, is_active, created_at, updated_at
		FROM interview_templates WHERE slug = $1
	`, slug)
	return scanTemplate(row)
}

func (r *Repository) ListTemplateSections(ctx context.Context, templateID string) ([]catalogmodel.TemplateSection, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT s.id, s.template_id, s.section_type, s.title, s.description, s.position,
		       s.passing_score,
		       COUNT(tst.task_id) AS tasks_count,
		       COALESCE(array_agg(tst.task_id::text ORDER BY tst.position)
		         FILTER (WHERE tst.task_id IS NOT NULL), '{}') AS task_ids,
		       s.created_at, s.updated_at
		FROM template_sections s
		LEFT JOIN template_section_tasks tst ON tst.section_id = s.id
		WHERE s.template_id = $1
		GROUP BY s.id
		ORDER BY s.position
	`, templateID)
	if err != nil {
		return nil, fmt.Errorf("list template sections: %w", err)
	}
	defer rows.Close()

	var items []catalogmodel.TemplateSection
	for rows.Next() {
		item, err := scanSection(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func scanTemplate(row pgx.Row) (*catalogmodel.InterviewTemplate, error) {
	var t catalogmodel.InterviewTemplate
	err := row.Scan(
		&t.ID, &t.CompanyID, &t.Slug, &t.Title, &t.Description,
		&t.TargetRole, &t.TargetLevel, &t.PassingScore, &t.IsActive,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan template: %w", err)
	}
	return &t, nil
}

func scanSection(row pgx.Row) (*catalogmodel.TemplateSection, error) {
	var s catalogmodel.TemplateSection
	err := row.Scan(
		&s.ID, &s.TemplateID, &s.SectionType, &s.Title, &s.Description,
		&s.Position, &s.PassingScore, &s.TasksCount, &s.TaskIDs,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan section: %w", err)
	}
	return &s, nil
}

// ListTasksFilter filters task list queries.
type ListTasksFilter struct {
	Type       *string
	Difficulty *string
	Status     *string
	Limit      int
	Offset     int
}

func (r *Repository) ListTasks(ctx context.Context, f ListTasksFilter) ([]catalogmodel.Task, error) {
	status := f.Status
	if status == nil {
		defaultStatus := "published"
		status = &defaultStatus
	}

	rows, err := r.pg.Query(ctx, `
		SELECT id, slug, type, title, description, difficulty, estimated_minutes,
		       metadata, status, created_at, updated_at
		FROM tasks
		WHERE ($1::text IS NULL OR type = $1)
		  AND ($2::text IS NULL OR difficulty = $2)
		  AND status = $3
		ORDER BY title
		LIMIT $4 OFFSET $5
	`, f.Type, f.Difficulty, status, f.Limit, f.Offset)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var items []catalogmodel.Task
	for rows.Next() {
		item, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetTaskByID(ctx context.Context, id string) (*catalogmodel.Task, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, type, title, description, difficulty, estimated_minutes,
		       metadata, status, created_at, updated_at
		FROM tasks WHERE id = $1
	`, id)
	return scanTask(row)
}

func (r *Repository) GetTaskBySlug(ctx context.Context, slug string) (*catalogmodel.Task, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, type, title, description, difficulty, estimated_minutes,
		       metadata, status, created_at, updated_at
		FROM tasks WHERE slug = $1
	`, slug)
	return scanTask(row)
}

func (r *Repository) ListTaskSolutions(ctx context.Context, taskID string) ([]catalogmodel.Solution, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT id, task_id, language, solution_text, explanation, complexity,
		       is_primary, created_at, updated_at
		FROM task_solutions
		WHERE task_id = $1
		ORDER BY is_primary DESC, created_at
	`, taskID)
	if err != nil {
		return nil, fmt.Errorf("list task solutions: %w", err)
	}
	defer rows.Close()

	var items []catalogmodel.Solution
	for rows.Next() {
		item, err := scanSolution(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func scanTask(row pgx.Row) (*catalogmodel.Task, error) {
	var t catalogmodel.Task
	err := row.Scan(
		&t.ID, &t.Slug, &t.Type, &t.Title, &t.Description, &t.Difficulty,
		&t.EstimatedMinutes, &t.Metadata, &t.Status, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan task: %w", err)
	}
	return &t, nil
}

func scanSolution(row pgx.Row) (*catalogmodel.Solution, error) {
	var s catalogmodel.Solution
	err := row.Scan(
		&s.ID, &s.TaskID, &s.Language, &s.SolutionText, &s.Explanation,
		&s.Complexity, &s.IsPrimary, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan solution: %w", err)
	}
	return &s, nil
}

func (r *Repository) GetRubricByID(ctx context.Context, id string) (*catalogmodel.Rubric, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, task_type, title, version, is_active, created_at, updated_at
		FROM rubrics WHERE id = $1
	`, id)
	return scanRubric(row)
}

func (r *Repository) GetActiveRubricByTaskType(ctx context.Context, taskType string) (*catalogmodel.Rubric, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, task_type, title, version, is_active, created_at, updated_at
		FROM rubrics
		WHERE task_type = $1 AND is_active = true
		ORDER BY version DESC
		LIMIT 1
	`, taskType)
	return scanRubric(row)
}

func (r *Repository) ListRubricCriteria(ctx context.Context, rubricID string) ([]catalogmodel.RubricCriterion, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT id, rubric_id, key, title, description, weight, max_score, position,
		       created_at, updated_at
		FROM rubric_criteria
		WHERE rubric_id = $1
		ORDER BY position
	`, rubricID)
	if err != nil {
		return nil, fmt.Errorf("list rubric criteria: %w", err)
	}
	defer rows.Close()

	var items []catalogmodel.RubricCriterion
	for rows.Next() {
		item, err := scanCriterion(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func scanRubric(row pgx.Row) (*catalogmodel.Rubric, error) {
	var rub catalogmodel.Rubric
	err := row.Scan(
		&rub.ID, &rub.TaskType, &rub.Title, &rub.Version,
		&rub.IsActive, &rub.CreatedAt, &rub.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan rubric: %w", err)
	}
	return &rub, nil
}

func scanCriterion(row pgx.Row) (*catalogmodel.RubricCriterion, error) {
	var c catalogmodel.RubricCriterion
	err := row.Scan(
		&c.ID, &c.RubricID, &c.Key, &c.Title, &c.Description,
		&c.Weight, &c.MaxScore, &c.Position, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan criterion: %w", err)
	}
	return &c, nil
}
