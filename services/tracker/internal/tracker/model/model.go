package model

import (
	"errors"
	"time"
)

var (
	ErrInvalidArgument = errors.New("invalid argument")
	ErrNotFound        = errors.New("not found")
	ErrForbidden       = errors.New("forbidden")
)

const (
	EventTaskCreated   = "tracker.task_created"
	EventTaskCompleted = "tracker.task_completed"

	DefaultProjectName = "Board"
	DefaultSprintName  = "This week"
)

type SprintStatus string

const (
	SprintStatusActive   SprintStatus = "active"
	SprintStatusArchived SprintStatus = "archived"
)

type TaskSource string

const (
	TaskSourceUser             TaskSource = "user"
	TaskSourceRecommendation   TaskSource = "recommendation"
	TaskSourceEnrichment       TaskSource = "enrichment"
)

type Project struct {
	ID        string
	UserID    string
	Name      string
	Position  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Epic struct {
	ID        string
	ProjectID string
	Name      string
	Position  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Sprint struct {
	ID         string
	ProjectID  string
	Name       string
	Goal       string
	Status     SprintStatus
	Position   int
	DoneCount  int
	TotalCount int
	CreatedAt  time.Time
	UpdatedAt  time.Time
	ArchivedAt *time.Time
}

type Task struct {
	ID          string
	SprintID    string
	EpicID      *string
	Title       string
	Done        bool
	Position    int
	Source      TaskSource
	Metadata    map[string]any
	DedupKey    *string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CompletedAt *time.Time
}

type Board struct {
	Project         *Project
	Epics           []Epic
	ActiveSprint    *Sprint
	Tasks           []Task
	ArchivedSprints []Sprint
}

type OutboxMessage struct {
	ID         string
	EventName  string
	Payload    map[string]any
	Status     string
	LockedUntil *time.Time
	RetryCount int
	LastError  *string
	CreatedAt  time.Time
	ProcessedAt *time.Time
}

type LearningBoard struct {
	ProjectID string
	SprintID  string
}
