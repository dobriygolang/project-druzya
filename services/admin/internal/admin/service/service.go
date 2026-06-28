package service

import (
	"context"
	"errors"
	"fmt"

	billingadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing"
	aiadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/ai"
	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	identityadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/identity"
)

// ErrInvalidInput marks bad request input.
var ErrInvalidInput = errors.New("invalid input")

// ErrNotFound marks missing entities.
var ErrNotFound = errors.New("not found")

// ErrVersionConflict marks optimistic lock failure.
var ErrVersionConflict = errors.New("version conflict")

// Service is the admin BFF orchestrator.
type Service interface {
	ListCompanies(ctx context.Context, filter contentadapter.ListCompaniesFilter) ([]contentadapter.Company, error)
	UpsertCompany(ctx context.Context, input contentadapter.UpsertCompanyInput) (*contentadapter.Company, error)
	ListTasks(ctx context.Context, filter contentadapter.ListTasksFilter) ([]contentadapter.Task, error)
	GetTask(ctx context.Context, id, slug string) (*contentadapter.Task, error)
	UpsertTask(ctx context.Context, input contentadapter.UpsertTaskInput) (*contentadapter.Task, error)
	ListArticles(ctx context.Context, filter contentadapter.ListArticlesFilter) ([]contentadapter.Article, error)
	GetArticle(ctx context.Context, id, slug string) (*contentadapter.Article, error)
	UpsertArticle(ctx context.Context, input contentadapter.UpsertArticleInput) (*contentadapter.Article, error)
	ListInterviewTemplates(ctx context.Context, filter contentadapter.ListInterviewTemplatesFilter) ([]contentadapter.InterviewTemplate, error)
	GetInterviewTemplateDetail(ctx context.Context, id, slug string) (*contentadapter.InterviewTemplateDetail, error)
	UpsertInterviewTemplate(ctx context.Context, input contentadapter.UpsertInterviewTemplateInput) (*contentadapter.InterviewTemplate, error)
	UpsertTemplateSection(ctx context.Context, input contentadapter.UpsertTemplateSectionInput) (*contentadapter.TemplateSection, error)
	ReplaceTemplateStructure(ctx context.Context, templateID string, sections []contentadapter.TemplateStructureSectionInput) (*contentadapter.InterviewTemplateDetail, error)
	ListPlans(ctx context.Context) ([]billingadapter.PlanCatalog, error)
	GetUserEntitlements(ctx context.Context, userID string) (*billingadapter.UserEntitlements, error)
	GrantSubscription(ctx context.Context, input billingadapter.GrantSubscriptionInput) (*billingadapter.GrantSubscriptionResult, error)
	RevokeSubscription(ctx context.Context, userID string) (bool, error)
	ListEvaluationJobs(ctx context.Context, status *aiadapter.EvaluationJobStatus, limit int) ([]aiadapter.EvaluationJob, error)
	GetEvaluationJob(ctx context.Context, id string) (*aiadapter.EvaluationJob, error)
	GetLLMConfig(ctx context.Context) (*aiadapter.LLMRuntimeConfig, error)
	UpdateLLMConfig(ctx context.Context, input aiadapter.UpdateLLMConfigInput) (*aiadapter.LLMRuntimeConfig, error)
	ProbeLLMProviders(ctx context.Context) ([]aiadapter.LLMProviderProbe, error)
	GetDashboard(ctx context.Context) (*Dashboard, error)
}

type adminService struct {
	identity identityadapter.Client
	content  contentadapter.Client
	billing  billingadapter.Client
	ai       aiadapter.Client
}

// Deps wires admin service dependencies.
type Deps struct {
	Identity identityadapter.Client
	Content  contentadapter.Client
	Billing  billingadapter.Client
	AI       aiadapter.Client
}

// New constructs admin service.
func New(deps Deps) Service {
	return &adminService{identity: deps.Identity, content: deps.Content, billing: deps.Billing, ai: deps.AI}
}

func (s *adminService) ListCompanies(ctx context.Context, filter contentadapter.ListCompaniesFilter) ([]contentadapter.Company, error) {
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	return s.content.ListCompanies(ctx, filter)
}

func (s *adminService) UpsertCompany(ctx context.Context, input contentadapter.UpsertCompanyInput) (*contentadapter.Company, error) {
	if input.Slug == "" || input.Name == "" {
		return nil, fmt.Errorf("slug and name required: %w", ErrInvalidInput)
	}
	return s.content.UpsertCompany(ctx, input)
}

func (s *adminService) ListTasks(ctx context.Context, filter contentadapter.ListTasksFilter) ([]contentadapter.Task, error) {
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	return s.content.ListTasks(ctx, filter)
}

func (s *adminService) GetTask(ctx context.Context, id, slug string) (*contentadapter.Task, error) {
	if id == "" && slug == "" {
		return nil, fmt.Errorf("id or slug required: %w", ErrInvalidInput)
	}
	task, err := s.content.GetTask(ctx, id, slug)
	if err != nil {
		if errors.Is(err, contentadapter.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return task, nil
}

func (s *adminService) UpsertTask(ctx context.Context, input contentadapter.UpsertTaskInput) (*contentadapter.Task, error) {
	if input.Slug == "" || input.Type == "" || input.Title == "" {
		return nil, fmt.Errorf("slug, type and title required: %w", ErrInvalidInput)
	}
	if input.Status == "" {
		input.Status = "draft"
	}
	if len(input.Metadata) == 0 {
		input.Metadata = []byte("{}")
	}
	return s.content.UpsertTask(ctx, input)
}

func (s *adminService) ListArticles(ctx context.Context, filter contentadapter.ListArticlesFilter) ([]contentadapter.Article, error) {
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if !filter.IncludeAll {
		filter.IncludeAll = true
	}
	return s.content.ListArticles(ctx, filter)
}

func (s *adminService) GetArticle(ctx context.Context, id, slug string) (*contentadapter.Article, error) {
	if id == "" && slug == "" {
		return nil, fmt.Errorf("id or slug required: %w", ErrInvalidInput)
	}
	article, err := s.content.GetArticle(ctx, id, slug)
	if err != nil {
		if errors.Is(err, contentadapter.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return article, nil
}

func (s *adminService) UpsertArticle(ctx context.Context, input contentadapter.UpsertArticleInput) (*contentadapter.Article, error) {
	if input.Slug == "" || input.Title == "" || input.Summary == "" || input.Body == "" {
		return nil, fmt.Errorf("slug, title, summary and body required: %w", ErrInvalidInput)
	}
	if input.Status == "" {
		input.Status = "draft"
	}
	return s.content.UpsertArticle(ctx, input)
}

func (s *adminService) ListInterviewTemplates(ctx context.Context, filter contentadapter.ListInterviewTemplatesFilter) ([]contentadapter.InterviewTemplate, error) {
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	return s.content.ListInterviewTemplates(ctx, filter)
}

func (s *adminService) GetInterviewTemplateDetail(ctx context.Context, id, slug string) (*contentadapter.InterviewTemplateDetail, error) {
	if id == "" && slug == "" {
		return nil, fmt.Errorf("id or slug required: %w", ErrInvalidInput)
	}
	detail, err := s.content.GetInterviewTemplateDetail(ctx, id, slug)
	if err != nil {
		if errors.Is(err, contentadapter.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return detail, nil
}

func (s *adminService) UpsertInterviewTemplate(ctx context.Context, input contentadapter.UpsertInterviewTemplateInput) (*contentadapter.InterviewTemplate, error) {
	if input.Slug == "" || input.Title == "" {
		return nil, fmt.Errorf("slug and title required: %w", ErrInvalidInput)
	}
	if input.PassingScore <= 0 {
		input.PassingScore = 85
	}
	return s.content.UpsertInterviewTemplate(ctx, input)
}

func (s *adminService) UpsertTemplateSection(ctx context.Context, input contentadapter.UpsertTemplateSectionInput) (*contentadapter.TemplateSection, error) {
	if input.TemplateID == "" || input.SectionType == "" || input.Title == "" {
		return nil, fmt.Errorf("template_id, section_type and title required: %w", ErrInvalidInput)
	}
	if input.Position <= 0 {
		return nil, fmt.Errorf("position must be positive: %w", ErrInvalidInput)
	}
	return s.content.UpsertTemplateSection(ctx, input)
}

func (s *adminService) ReplaceTemplateStructure(
	ctx context.Context,
	templateID string,
	sections []contentadapter.TemplateStructureSectionInput,
) (*contentadapter.InterviewTemplateDetail, error) {
	if templateID == "" {
		return nil, fmt.Errorf("template_id required: %w", ErrInvalidInput)
	}
	detail, err := s.content.ReplaceTemplateStructure(ctx, templateID, sections)
	if err != nil {
		if errors.Is(err, contentadapter.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return detail, nil
}

func (s *adminService) ListPlans(ctx context.Context) ([]billingadapter.PlanCatalog, error) {
	return s.billing.ListPlans(ctx)
}

func (s *adminService) GetUserEntitlements(ctx context.Context, userID string) (*billingadapter.UserEntitlements, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}
	view, err := s.billing.GetUserEntitlements(ctx, userID)
	if err != nil {
		if errors.Is(err, billingadapter.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return view, nil
}

func (s *adminService) GrantSubscription(ctx context.Context, input billingadapter.GrantSubscriptionInput) (*billingadapter.GrantSubscriptionResult, error) {
	if input.UserID == "" || input.PlanSlug == "" {
		return nil, fmt.Errorf("user_id and plan_slug required: %w", ErrInvalidInput)
	}
	return s.billing.GrantSubscription(ctx, input)
}

func (s *adminService) RevokeSubscription(ctx context.Context, userID string) (bool, error) {
	if userID == "" {
		return false, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}
	return s.billing.RevokeSubscription(ctx, userID)
}

func (s *adminService) ListEvaluationJobs(ctx context.Context, status *aiadapter.EvaluationJobStatus, limit int) ([]aiadapter.EvaluationJob, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.ai.ListEvaluationJobs(ctx, status, limit)
}

func (s *adminService) GetEvaluationJob(ctx context.Context, id string) (*aiadapter.EvaluationJob, error) {
	if id == "" {
		return nil, fmt.Errorf("id required: %w", ErrInvalidInput)
	}
	job, err := s.ai.GetEvaluationJob(ctx, id)
	if err != nil {
		if errors.Is(err, aiadapter.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return job, nil
}

func (s *adminService) GetLLMConfig(ctx context.Context) (*aiadapter.LLMRuntimeConfig, error) {
	return s.ai.GetLLMConfig(ctx)
}

func (s *adminService) UpdateLLMConfig(ctx context.Context, input aiadapter.UpdateLLMConfigInput) (*aiadapter.LLMRuntimeConfig, error) {
	if input.ExpectedVersion < 0 {
		return nil, fmt.Errorf("expected_version required: %w", ErrInvalidInput)
	}
	cfg, err := s.ai.UpdateLLMConfig(ctx, input)
	if err != nil {
		if errors.Is(err, aiadapter.ErrVersionConflict) {
			return nil, ErrVersionConflict
		}
		return nil, err
	}
	return cfg, nil
}

func (s *adminService) ProbeLLMProviders(ctx context.Context) ([]aiadapter.LLMProviderProbe, error) {
	return s.ai.ProbeLLMProviders(ctx)
}
