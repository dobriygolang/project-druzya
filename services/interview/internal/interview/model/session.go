package model

import (
	"encoding/json"
	"time"

	"github.com/shopspring/decimal"
)

// Session is a user interview runtime instance.
type Session struct {
	ID           string
	UserID       string
	TemplateID   *string
	Mode         SessionMode
	Status       SessionStatus
	StartedAt    time.Time
	CompletedAt  *time.Time
	PassingScore int
	TotalScore   *decimal.Decimal
	Outcome      *SessionOutcome
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// SessionSection is a section snapshot inside a session.
type SessionSection struct {
	ID           string
	SessionID    string
	SectionType  string
	Title        string
	Position     int
	Status       SectionStatus
	PassingScore *int
	Score        *decimal.Decimal
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// SessionTask assigns a content task to a session section.
type SessionTask struct {
	ID        string
	SessionID string
	SectionID string
	TaskID    string
	TaskTitle *string
	TaskType  *string
	Position  int
	Status    SessionTaskStatus
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Attachment is metadata for an attempt attachment reference.
type Attachment struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	Type string `json:"type"`
}

// Attempt is a user submission for a session task.
type Attempt struct {
	ID            string
	UserID        string
	SessionTaskID string
	TaskID        string
	AnswerText    *string
	Code          *string
	Language      *string
	Attachments   json.RawMessage
	Status        AttemptStatus
	SubmittedAt   time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// EvaluationSummary is the user-facing evaluation result for an attempt.
type EvaluationSummary struct {
	ID        string
	AttemptID string
	Score     decimal.Decimal
	Passed    bool
	Summary   *string
	Feedback  json.RawMessage
	CreatedAt time.Time
	UpdatedAt time.Time
}

// RetryItem is a queued task for mistake retry.
type RetryItem struct {
	ID              string
	UserID          string
	TaskID          string
	SourceAttemptID string
	SessionID       *string
	Reason          *string
	Status          RetryItemStatus
	NextRetryAt     *time.Time
	ResolvedAt      *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// SessionDetail aggregates session runtime data.
type SessionDetail struct {
	Session *Session
	Sections []SessionSection
	Tasks    []SessionTask
	Progress Progress
}

// SessionState is the current pointer within a session.
type SessionState struct {
	Session        *Session
	Sections       []SessionSection
	CurrentSection *SessionSection
	CurrentTask    *SessionTask
	Progress       Progress
}

// Progress summarizes completion metrics.
type Progress struct {
	TotalTasks     int
	EvaluatedTasks int
	SkippedTasks   int
	TotalSections  int
	DoneSections   int
}

// SessionResults includes evaluations for a completed session.
type SessionResults struct {
	Session     *Session
	Sections    []SessionSection
	Tasks       []SessionTask
	Evaluations []EvaluationWithAttempt
	Progress    Progress
}

// EvaluationWithAttempt pairs summary with attempt metadata.
type EvaluationWithAttempt struct {
	Summary   *EvaluationSummary
	Attempt   *Attempt
	TaskID    string
	SectionID string
}
