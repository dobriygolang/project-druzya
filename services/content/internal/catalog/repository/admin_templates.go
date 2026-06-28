package repository

import (
	"context"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// UpsertInterviewTemplate inserts or updates a template by slug.
func (r *Repository) UpsertInterviewTemplate(ctx context.Context, t catalogmodel.InterviewTemplate) (*catalogmodel.InterviewTemplate, error) {
	passingScore := t.PassingScore
	if passingScore <= 0 {
		passingScore = 85
	}
	row := r.pg.QueryRow(ctx, `
		INSERT INTO interview_templates (
			id, company_id, slug, title, description, target_role, target_level, passing_score, is_active
		)
		VALUES (
			COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()),
			NULLIF($2, '')::uuid, $3, $4, $5, $6, $7, $8, $9
		)
		ON CONFLICT (slug) DO UPDATE SET
			company_id = EXCLUDED.company_id,
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			target_role = EXCLUDED.target_role,
			target_level = EXCLUDED.target_level,
			passing_score = EXCLUDED.passing_score,
			is_active = EXCLUDED.is_active,
			updated_at = now()
		RETURNING id, company_id, slug, title, description, target_role, target_level, passing_score, is_active, created_at, updated_at
	`, nullUUID(t.ID), nullStringPtr(t.CompanyID), t.Slug, t.Title, t.Description, t.TargetRole, t.TargetLevel, passingScore, t.IsActive)
	return scanTemplate(row)
}

// UpsertTemplateSection inserts or updates a section by template_id + position.
func (r *Repository) UpsertTemplateSection(ctx context.Context, s catalogmodel.TemplateSection) (*catalogmodel.TemplateSection, error) {
	row := r.pg.QueryRow(ctx, `
		INSERT INTO template_sections (
			id, template_id, section_type, title, description, position, passing_score
		)
		VALUES (
			COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()),
			$2::uuid, $3, $4, $5, $6, $7
		)
		ON CONFLICT (template_id, position) DO UPDATE SET
			section_type = EXCLUDED.section_type,
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			passing_score = EXCLUDED.passing_score,
			updated_at = now()
		RETURNING id
	`, nullUUID(s.ID), s.TemplateID, s.SectionType, s.Title, s.Description, s.Position, s.PassingScore)
	var sectionID string
	if err := row.Scan(&sectionID); err != nil {
		return nil, fmt.Errorf("upsert template section: %w", err)
	}
	return r.getTemplateSectionByID(ctx, sectionID)
}

func (r *Repository) getTemplateSectionByID(ctx context.Context, id string) (*catalogmodel.TemplateSection, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT s.id, s.template_id, s.section_type, s.title, s.description, s.position,
		       s.passing_score,
		       COALESCE(COUNT(tst.task_id), 0)::int AS tasks_count,
		       COALESCE(array_agg(tst.task_id ORDER BY tst.position) FILTER (WHERE tst.task_id IS NOT NULL), '{}') AS task_ids,
		       s.created_at, s.updated_at
		FROM template_sections s
		LEFT JOIN template_section_tasks tst ON tst.section_id = s.id
		WHERE s.id = $1
		GROUP BY s.id
	`, id)
	return scanSection(row)
}

// ReplaceTemplateStructure replaces all sections and task links for a template atomically.
func (r *Repository) ReplaceTemplateStructure(
	ctx context.Context,
	templateID string,
	sections []catalogmodel.TemplateSectionInput,
) (*catalogmodel.InterviewTemplateDetail, error) {
	tx, err := r.pg.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM interview_templates WHERE id = $1::uuid)`, templateID).Scan(&exists); err != nil {
		return nil, fmt.Errorf("check template: %w", err)
	}
	if !exists {
		return nil, ErrNotFound
	}

	if _, err := tx.Exec(ctx, `DELETE FROM template_sections WHERE template_id = $1::uuid`, templateID); err != nil {
		return nil, fmt.Errorf("delete sections: %w", err)
	}

	for _, sec := range sections {
		var sectionID string
		err := tx.QueryRow(ctx, `
			INSERT INTO template_sections (
				id, template_id, section_type, title, description, position, passing_score
			)
			VALUES (
				COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()),
				$2::uuid, $3, $4, $5, $6, $7
			)
			RETURNING id
		`, nullUUID(sec.ID), templateID, sec.SectionType, sec.Title, sec.Description, sec.Position, sec.PassingScore).Scan(&sectionID)
		if err != nil {
			return nil, fmt.Errorf("insert section at position %d: %w", sec.Position, err)
		}

		for pos, taskID := range sec.TaskIDs {
			if taskID == "" {
				continue
			}
			var taskExists bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1::uuid)`, taskID).Scan(&taskExists); err != nil {
				return nil, fmt.Errorf("check task %s: %w", taskID, err)
			}
			if !taskExists {
				return nil, fmt.Errorf("task %s not found: %w", taskID, ErrNotFound)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO template_section_tasks (section_id, task_id, position)
				VALUES ($1::uuid, $2::uuid, $3)
			`, sectionID, taskID, pos+1); err != nil {
				return nil, fmt.Errorf("link task %s: %w", taskID, err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	template, err := r.GetInterviewTemplateByID(ctx, templateID)
	if err != nil {
		return nil, err
	}
	loadedSections, err := r.ListTemplateSections(ctx, templateID)
	if err != nil {
		return nil, err
	}
	return &catalogmodel.InterviewTemplateDetail{
		Template: template,
		Sections: loadedSections,
	}, nil
}

func nullStringPtr(v *string) *string {
	if v == nil || *v == "" {
		return nil
	}
	return v
}
