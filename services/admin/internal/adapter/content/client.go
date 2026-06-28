package content

import (
	"context"
	"encoding/json"
	"time"
)

// Company is catalog company metadata.
type Company struct {
	ID          string
	Slug        string
	Name        string
	Description *string
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Task is catalog task metadata.
type Task struct {
	ID               string
	Slug             string
	Type             string
	Title            string
	Description      string
	Difficulty       string
	EstimatedMinutes *int
	Metadata         json.RawMessage
	Status           string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// ArticleVideo is an external video linked from an article.
type ArticleVideo struct {
	Title           string
	URL             string
	Provider        string
	Position        int
	DurationSeconds *int
}

// ArticleTaskLink is a recommended practice task.
type ArticleTaskLink struct {
	TaskID     string
	Slug       string
	Title      string
	Type       string
	Difficulty string
	Position   int
}

// Article is a knowledge-base article.
type Article struct {
	ID             string
	Slug           string
	Title          string
	Summary        string
	Body           string
	Status         string
	ReadingMinutes *int
	SkillKeys      []string
	Videos         []ArticleVideo
	LinkedTasks    []ArticleTaskLink
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ListCompaniesFilter lists companies.
type ListCompaniesFilter struct {
	ActiveOnly bool
	Limit      int
	Offset     int
}

// ListTasksFilter lists tasks.
type ListTasksFilter struct {
	Type       *string
	Difficulty *string
	Status     *string
	Limit      int
	Offset     int
}

// ListArticlesFilter lists articles.
type ListArticlesFilter struct {
	Status         *string
	IncludeAll     bool
	Limit          int
	Offset         int
}

// UpsertCompanyInput writes a company.
type UpsertCompanyInput struct {
	ID          *string
	Slug        string
	Name        string
	Description *string
	IsActive    bool
}

// UpsertTaskInput writes a task.
type UpsertTaskInput struct {
	ID               *string
	Slug             string
	Type             string
	Title            string
	Description      string
	Difficulty       string
	EstimatedMinutes *int
	Metadata         json.RawMessage
	Status           string
}

// UpsertArticleInput writes an article.
type UpsertArticleInput struct {
	ID             *string
	Slug           string
	Title          string
	Summary        string
	Body           string
	Status         string
	ReadingMinutes *int
	SkillKeys      []string
	Videos         []ArticleVideo
	TaskSlugs      []string
}

// InterviewTemplate is catalog interview blueprint metadata.
type InterviewTemplate struct {
	ID           string
	CompanyID    *string
	Slug         string
	Title        string
	Description  *string
	TargetRole   *string
	TargetLevel  *string
	PassingScore int
	IsActive     bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// TemplateSection is an ordered block inside a template.
type TemplateSection struct {
	ID           string
	TemplateID   string
	SectionType  string
	Title        string
	Description  *string
	Position     int
	PassingScore *int
	TasksCount   int
	TaskIDs      []string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// InterviewTemplateDetail is a template with sections.
type InterviewTemplateDetail struct {
	Template InterviewTemplate
	Sections []TemplateSection
}

// ListInterviewTemplatesFilter lists templates.
type ListInterviewTemplatesFilter struct {
	CompanyID  *string
	ActiveOnly bool
	Limit      int
	Offset     int
}

// UpsertInterviewTemplateInput writes a template.
type UpsertInterviewTemplateInput struct {
	ID           *string
	CompanyID    *string
	Slug         string
	Title        string
	Description  *string
	TargetRole   *string
	TargetLevel  *string
	PassingScore int
	IsActive     bool
}

// UpsertTemplateSectionInput writes a section.
type UpsertTemplateSectionInput struct {
	ID           *string
	TemplateID   string
	SectionType  string
	Title        string
	Description  *string
	Position     int
	PassingScore *int
}

// TemplateStructureSectionInput is a section payload for structure replace.
type TemplateStructureSectionInput struct {
	ID           *string
	SectionType  string
	Title        string
	Description  *string
	Position     int
	PassingScore *int
	TaskIDs      []string
}

// Client reads and writes content catalog via gRPC.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	Ping(ctx context.Context) error
	ListCompanies(ctx context.Context, filter ListCompaniesFilter) ([]Company, error)
	UpsertCompany(ctx context.Context, input UpsertCompanyInput) (*Company, error)
	ListTasks(ctx context.Context, filter ListTasksFilter) ([]Task, error)
	GetTask(ctx context.Context, id, slug string) (*Task, error)
	UpsertTask(ctx context.Context, input UpsertTaskInput) (*Task, error)
	ListArticles(ctx context.Context, filter ListArticlesFilter) ([]Article, error)
	GetArticle(ctx context.Context, id, slug string) (*Article, error)
	UpsertArticle(ctx context.Context, input UpsertArticleInput) (*Article, error)
	ListInterviewTemplates(ctx context.Context, filter ListInterviewTemplatesFilter) ([]InterviewTemplate, error)
	GetInterviewTemplateDetail(ctx context.Context, id, slug string) (*InterviewTemplateDetail, error)
	UpsertInterviewTemplate(ctx context.Context, input UpsertInterviewTemplateInput) (*InterviewTemplate, error)
	UpsertTemplateSection(ctx context.Context, input UpsertTemplateSectionInput) (*TemplateSection, error)
	ReplaceTemplateStructure(ctx context.Context, templateID string, sections []TemplateStructureSectionInput) (*InterviewTemplateDetail, error)
	GetOpsStats(ctx context.Context) (*OpsStats, error)
}

// OpsStats is database footprint and process runtime metrics.
type OpsStats struct {
	ServiceName       string
	DatabaseName      string
	DatabaseSizeBytes int64
	MemoryAllocBytes  int64
	MemorySysBytes    int64
	Goroutines        int
	HTTPRPS           float64
}
