package content

import "context"

// TemplateDetail is a snapshot input from content-service.
type TemplateDetail struct {
	TemplateID   string
	PassingScore int
	Sections     []TemplateSection
}

// TemplateSection is a section with ordered task ids.
type TemplateSection struct {
	SectionType  string
	Title        string
	Position     int
	PassingScore *int
	TaskIDs      []string
}

// Task is minimal task metadata from content-service.
type Task struct {
	ID          string
	Slug        string
	Type        string
	Title       string
	Description string
	Status      string
}

// InterviewTemplate is a catalog interview blueprint summary.
type InterviewTemplate struct {
	ID        string
	CompanyID string
	Title     string
}

// Client reads catalog data from content-service.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	GetInterviewTemplateDetail(ctx context.Context, templateID string) (*TemplateDetail, error)
	ListInterviewTemplates(ctx context.Context, companyID string, activeOnly bool, limit int) ([]InterviewTemplate, error)
	GetTask(ctx context.Context, taskID string) (*Task, error)
	ListTasks(ctx context.Context, taskType string, limit int) ([]Task, error)
}
