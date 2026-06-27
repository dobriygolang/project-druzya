package model

import "time"

// InterviewTemplate is an interview blueprint.
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

// InterviewTemplateDetail is a template with ordered sections for interview-service.
type InterviewTemplateDetail struct {
	Template *InterviewTemplate
	Sections []TemplateSection
}
