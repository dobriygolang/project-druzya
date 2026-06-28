package service

import (
	"context"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// AdminService is internal catalog write API.
type AdminService interface {
	UpsertCompany(ctx context.Context, c catalogmodel.Company) (*catalogmodel.Company, error)
	UpsertTask(ctx context.Context, t catalogmodel.Task) (*catalogmodel.Task, error)
	GetTaskForAdmin(ctx context.Context, id, slug string) (*catalogmodel.Task, []catalogmodel.Solution, error)
	ReplaceTaskSolutions(ctx context.Context, taskID string, solutions []catalogmodel.Solution) ([]catalogmodel.Solution, error)
	UpsertInterviewTemplate(ctx context.Context, t catalogmodel.InterviewTemplate) (*catalogmodel.InterviewTemplate, error)
	UpsertTemplateSection(ctx context.Context, s catalogmodel.TemplateSection) (*catalogmodel.TemplateSection, error)
	ReplaceTemplateStructure(ctx context.Context, templateID string, sections []catalogmodel.TemplateSectionInput) (*catalogmodel.InterviewTemplateDetail, error)
	UpsertArticle(ctx context.Context, a catalogmodel.Article) (*catalogmodel.Article, error)
}

func (s *catalogService) UpsertCompany(ctx context.Context, c catalogmodel.Company) (*catalogmodel.Company, error) {
	if c.Slug == "" || c.Name == "" {
		return nil, fmt.Errorf("slug and name are required: %w", ErrInvalidArgument)
	}
	return s.repo.UpsertCompany(ctx, c)
}

func (s *catalogService) UpsertTask(ctx context.Context, t catalogmodel.Task) (*catalogmodel.Task, error) {
	if t.Slug == "" || t.Title == "" || t.Type == "" {
		return nil, fmt.Errorf("slug, title, and type are required: %w", ErrInvalidArgument)
	}
	if t.Status == "" {
		t.Status = "draft"
	}
	return s.repo.UpsertTask(ctx, t)
}

func (s *catalogService) GetTaskForAdmin(ctx context.Context, id, slug string) (*catalogmodel.Task, []catalogmodel.Solution, error) {
	var (
		task *catalogmodel.Task
		err  error
	)
	switch {
	case id != "":
		task, err = s.repo.GetTaskByID(ctx, id)
	case slug != "":
		task, err = s.repo.GetTaskBySlug(ctx, slug)
	default:
		return nil, nil, fmt.Errorf("id or slug is required: %w", ErrInvalidArgument)
	}
	if err != nil {
		return nil, nil, err
	}
	solutions, err := s.repo.ListTaskSolutions(ctx, task.ID)
	if err != nil {
		return nil, nil, err
	}
	return task, solutions, nil
}

func (s *catalogService) ReplaceTaskSolutions(
	ctx context.Context,
	taskID string,
	solutions []catalogmodel.Solution,
) ([]catalogmodel.Solution, error) {
	if taskID == "" {
		return nil, fmt.Errorf("task_id is required: %w", ErrInvalidArgument)
	}
	primaryCount := 0
	for _, sol := range solutions {
		if sol.SolutionText == "" {
			return nil, fmt.Errorf("solution_text is required: %w", ErrInvalidArgument)
		}
		if sol.IsPrimary {
			primaryCount++
		}
	}
	if primaryCount > 1 {
		return nil, fmt.Errorf("at most one primary solution allowed: %w", ErrInvalidArgument)
	}
	return s.repo.ReplaceTaskSolutions(ctx, taskID, solutions)
}

func (s *catalogService) UpsertInterviewTemplate(ctx context.Context, t catalogmodel.InterviewTemplate) (*catalogmodel.InterviewTemplate, error) {
	if t.Slug == "" || t.Title == "" {
		return nil, fmt.Errorf("slug and title are required: %w", ErrInvalidArgument)
	}
	if t.PassingScore <= 0 {
		t.PassingScore = 85
	}
	return s.repo.UpsertInterviewTemplate(ctx, t)
}

func (s *catalogService) UpsertTemplateSection(ctx context.Context, sec catalogmodel.TemplateSection) (*catalogmodel.TemplateSection, error) {
	if sec.TemplateID == "" || sec.SectionType == "" || sec.Title == "" {
		return nil, fmt.Errorf("template_id, section_type and title are required: %w", ErrInvalidArgument)
	}
	if sec.Position <= 0 {
		return nil, fmt.Errorf("position must be positive: %w", ErrInvalidArgument)
	}
	return s.repo.UpsertTemplateSection(ctx, sec)
}

func (s *catalogService) ReplaceTemplateStructure(
	ctx context.Context,
	templateID string,
	sections []catalogmodel.TemplateSectionInput,
) (*catalogmodel.InterviewTemplateDetail, error) {
	if templateID == "" {
		return nil, fmt.Errorf("template_id is required: %w", ErrInvalidArgument)
	}
	positions := make(map[int]struct{}, len(sections))
	for _, sec := range sections {
		if sec.SectionType == "" || sec.Title == "" {
			return nil, fmt.Errorf("section_type and title are required: %w", ErrInvalidArgument)
		}
		if sec.Position <= 0 {
			return nil, fmt.Errorf("section position must be positive: %w", ErrInvalidArgument)
		}
		if _, ok := positions[sec.Position]; ok {
			return nil, fmt.Errorf("duplicate section position %d: %w", sec.Position, ErrInvalidArgument)
		}
		positions[sec.Position] = struct{}{}
	}
	return s.repo.ReplaceTemplateStructure(ctx, templateID, sections)
}

func (s *catalogService) UpsertArticle(ctx context.Context, a catalogmodel.Article) (*catalogmodel.Article, error) {
	if a.Slug == "" || a.Title == "" || a.Summary == "" || a.Body == "" {
		return nil, fmt.Errorf("slug, title, summary and body are required: %w", ErrInvalidArgument)
	}
	if a.Status == "" {
		a.Status = catalogmodel.ArticleStatusDraft
	}
	return s.repo.UpsertArticle(ctx, a)
}
