package service

import (
	"context"
	"errors"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
)

const (
	defaultLimit = 50
	maxLimit     = 100
)

// ErrNotFound is returned when a catalog entity does not exist.
var ErrNotFound = catalogrepo.ErrNotFound

// ErrInvalidArgument is returned when required input is missing or malformed.
var ErrInvalidArgument = errors.New("invalid argument")

// Service is catalog read use cases.
type Service interface {
	ListCompanies(ctx context.Context, activeOnly bool, limit, offset int) ([]catalogmodel.Company, error)
	GetCompany(ctx context.Context, id, slug string) (*catalogmodel.Company, error)
	ListInterviewTemplates(ctx context.Context, companyID *string, activeOnly bool, limit, offset int) ([]catalogmodel.InterviewTemplate, error)
	GetInterviewTemplateDetail(ctx context.Context, id, slug string) (*catalogmodel.InterviewTemplateDetail, error)
	ListTasks(ctx context.Context, taskType, difficulty, status *string, limit, offset int) ([]catalogmodel.Task, error)
	GetTask(ctx context.Context, id, slug string) (*catalogmodel.Task, error)
	GetTaskBundle(ctx context.Context, taskID string) (*catalogmodel.TaskBundle, error)
	GetRubric(ctx context.Context, rubricID string) (*catalogmodel.Rubric, []catalogmodel.RubricCriterion, error)
	ListArticles(ctx context.Context, skillKey, query *string, limit, offset int) ([]catalogmodel.Article, error)
	ListArticlesAdmin(ctx context.Context, status *catalogmodel.ArticleStatus, allStatuses bool, query *string, limit, offset int) ([]catalogmodel.Article, error)
	ListPublishedArticlesBySkillKeys(ctx context.Context, skillKeys []string) ([]catalogmodel.Article, error)
	GetArticle(ctx context.Context, id, slug string) (*catalogmodel.Article, error)
	ListRelatedArticles(ctx context.Context, articleID string, skillKeys []string, limit int) ([]catalogmodel.Article, error)
	ResolveTaskIDs(ctx context.Context, slugs []string) ([]string, error)
	AdminService
}

type catalogService struct {
	repo Store
}

// Deps holds catalog service dependencies.
type Deps struct {
	Repo Store
}

// New constructs a catalog service.
func New(deps Deps) Service {
	return &catalogService{repo: deps.Repo}
}

func normalizeLimit(limit int) int {
	switch {
	case limit <= 0:
		return defaultLimit
	case limit > maxLimit:
		return maxLimit
	default:
		return limit
	}
}

func normalizeOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}

func (s *catalogService) ListCompanies(ctx context.Context, activeOnly bool, limit, offset int) ([]catalogmodel.Company, error) {
	return s.repo.ListCompanies(ctx, catalogrepo.ListCompaniesFilter{
		ActiveOnly: activeOnly,
		Limit:      normalizeLimit(limit),
		Offset:     normalizeOffset(offset),
	})
}

func (s *catalogService) GetCompany(ctx context.Context, id, slug string) (*catalogmodel.Company, error) {
	switch {
	case id != "":
		return s.repo.GetCompanyByID(ctx, id)
	case slug != "":
		return s.repo.GetCompanyBySlug(ctx, slug)
	default:
		return nil, fmt.Errorf("id or slug is required: %w", ErrInvalidArgument)
	}
}

func (s *catalogService) ListInterviewTemplates(
	ctx context.Context,
	companyID *string,
	activeOnly bool,
	limit, offset int,
) ([]catalogmodel.InterviewTemplate, error) {
	return s.repo.ListInterviewTemplates(ctx, catalogrepo.ListTemplatesFilter{
		CompanyID:  companyID,
		ActiveOnly: activeOnly,
		Limit:      normalizeLimit(limit),
		Offset:     normalizeOffset(offset),
	})
}

func (s *catalogService) GetInterviewTemplateDetail(ctx context.Context, id, slug string) (*catalogmodel.InterviewTemplateDetail, error) {
	var (
		template *catalogmodel.InterviewTemplate
		err      error
	)
	switch {
	case id != "":
		template, err = s.repo.GetInterviewTemplateByID(ctx, id)
	case slug != "":
		template, err = s.repo.GetInterviewTemplateBySlug(ctx, slug)
	default:
		return nil, fmt.Errorf("id or slug is required: %w", ErrInvalidArgument)
	}
	if err != nil {
		return nil, err
	}

	sections, err := s.repo.ListTemplateSections(ctx, template.ID)
	if err != nil {
		return nil, err
	}

	return &catalogmodel.InterviewTemplateDetail{
		Template: template,
		Sections: sections,
	}, nil
}

func (s *catalogService) ListTasks(
	ctx context.Context,
	taskType, difficulty, status *string,
	limit, offset int,
) ([]catalogmodel.Task, error) {
	return s.repo.ListTasks(ctx, catalogrepo.ListTasksFilter{
		Type:       taskType,
		Difficulty: difficulty,
		Status:     status,
		Limit:      normalizeLimit(limit),
		Offset:     normalizeOffset(offset),
	})
}

func (s *catalogService) GetTask(ctx context.Context, id, slug string) (*catalogmodel.Task, error) {
	switch {
	case id != "":
		return s.repo.GetTaskByID(ctx, id)
	case slug != "":
		return s.repo.GetTaskBySlug(ctx, slug)
	default:
		return nil, fmt.Errorf("id or slug is required: %w", ErrInvalidArgument)
	}
}

func (s *catalogService) GetTaskBundle(ctx context.Context, taskID string) (*catalogmodel.TaskBundle, error) {
	if taskID == "" {
		return nil, fmt.Errorf("task_id is required: %w", ErrInvalidArgument)
	}

	task, err := s.repo.GetTaskByID(ctx, taskID)
	if err != nil {
		return nil, err
	}

	solutions, err := s.repo.ListTaskSolutions(ctx, taskID)
	if err != nil {
		return nil, err
	}

	rubric, err := s.repo.GetActiveRubricByTaskType(ctx, task.Type)
	if err != nil {
		return nil, err
	}

	criteria, err := s.repo.ListRubricCriteria(ctx, rubric.ID)
	if err != nil {
		return nil, err
	}

	return &catalogmodel.TaskBundle{
		Task:      task,
		Solutions: solutions,
		Rubric:    rubric,
		Criteria:  criteria,
	}, nil
}

func (s *catalogService) GetRubric(ctx context.Context, rubricID string) (*catalogmodel.Rubric, []catalogmodel.RubricCriterion, error) {
	if rubricID == "" {
		return nil, nil, fmt.Errorf("rubric_id is required: %w", ErrInvalidArgument)
	}

	rubric, err := s.repo.GetRubricByID(ctx, rubricID)
	if err != nil {
		return nil, nil, err
	}

	criteria, err := s.repo.ListRubricCriteria(ctx, rubricID)
	if err != nil {
		return nil, nil, err
	}

	return rubric, criteria, nil
}

// IsNotFound reports whether err is a catalog not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// IsInvalidArgument reports whether err is a catalog invalid-argument error.
func IsInvalidArgument(err error) bool {
	return errors.Is(err, ErrInvalidArgument)
}
