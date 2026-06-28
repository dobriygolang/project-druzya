package service

import (
	"context"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
)

// Store is the persistence port used by the catalog service. The concrete
// Postgres repository satisfies it; tests use a mock/fake.
type Store interface {
	ListCompanies(ctx context.Context, f catalogrepo.ListCompaniesFilter) ([]catalogmodel.Company, error)
	GetCompanyByID(ctx context.Context, id string) (*catalogmodel.Company, error)
	GetCompanyBySlug(ctx context.Context, slug string) (*catalogmodel.Company, error)
	ListInterviewTemplates(ctx context.Context, f catalogrepo.ListTemplatesFilter) ([]catalogmodel.InterviewTemplate, error)
	GetInterviewTemplateByID(ctx context.Context, id string) (*catalogmodel.InterviewTemplate, error)
	GetInterviewTemplateBySlug(ctx context.Context, slug string) (*catalogmodel.InterviewTemplate, error)
	ListTemplateSections(ctx context.Context, templateID string) ([]catalogmodel.TemplateSection, error)
	ListTasks(ctx context.Context, f catalogrepo.ListTasksFilter) ([]catalogmodel.Task, error)
	GetTaskByID(ctx context.Context, id string) (*catalogmodel.Task, error)
	GetTaskBySlug(ctx context.Context, slug string) (*catalogmodel.Task, error)
	ListTaskSolutions(ctx context.Context, taskID string) ([]catalogmodel.Solution, error)
	GetActiveRubricByTaskType(ctx context.Context, taskType string) (*catalogmodel.Rubric, error)
	GetRubricByID(ctx context.Context, rubricID string) (*catalogmodel.Rubric, error)
	ListRubricCriteria(ctx context.Context, rubricID string) ([]catalogmodel.RubricCriterion, error)
	ListArticles(ctx context.Context, f catalogrepo.ListArticlesFilter) ([]catalogmodel.Article, error)
	ListPublishedArticlesBySkillKeys(ctx context.Context, skillKeys []string) ([]catalogmodel.Article, error)
	GetArticleByID(ctx context.Context, id string) (*catalogmodel.Article, error)
	GetArticleBySlug(ctx context.Context, slug string) (*catalogmodel.Article, error)
	ListRelatedArticles(ctx context.Context, articleID string, skillKeys []string, limit int) ([]catalogmodel.Article, error)
	UpsertArticle(ctx context.Context, a catalogmodel.Article) (*catalogmodel.Article, error)
	UpsertCompany(ctx context.Context, c catalogmodel.Company) (*catalogmodel.Company, error)
	UpsertTask(ctx context.Context, t catalogmodel.Task) (*catalogmodel.Task, error)
	UpsertInterviewTemplate(ctx context.Context, t catalogmodel.InterviewTemplate) (*catalogmodel.InterviewTemplate, error)
	UpsertTemplateSection(ctx context.Context, s catalogmodel.TemplateSection) (*catalogmodel.TemplateSection, error)
	ReplaceTemplateStructure(ctx context.Context, templateID string, sections []catalogmodel.TemplateSectionInput) (*catalogmodel.InterviewTemplateDetail, error)
}

var _ Store = (*catalogrepo.Repository)(nil)
