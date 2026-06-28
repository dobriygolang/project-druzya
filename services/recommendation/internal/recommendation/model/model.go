package model

import "time"

const (
	ConsumerAttemptEvaluated  = "recommendation.attempt_evaluated"
	ConsumerSessionCompleted  = "recommendation.session_completed"
	ConsumerRetryItemCreated  = "recommendation.retry_item_created"
	ConsumerTaskSkipped       = "recommendation.task_skipped"

	RecTypeImproveSkill      = "improve_skill"
	RecTypeRewriteAnswer     = "rewrite_answer"
	RecTypePracticeSection   = "practice_section"
	RecTypeTakeMockInterview = "take_mock_interview"

	PlanTypeRetryTask = "retry_task"

	RecStatusActive    = "active"
	RecStatusDismissed = "dismissed"
	RecStatusCompleted = "completed"

	PlanStatusPending    = "pending"
	PlanStatusInProgress = "in_progress"
	PlanStatusCompleted  = "completed"
	PlanStatusDismissed  = "dismissed"

	PriorityHigh   = "high"
	PriorityMedium = "medium"
	PriorityLow    = "low"
)

// UserSkillProfile tracks aggregate readiness for a user.
type UserSkillProfile struct {
	ID                string
	UserID            string
	ReadinessScore    int
	ProfileSummary    *string
	SummaryUpdatedAt  *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// SkillScore tracks per-skill performance for a user.
type SkillScore struct {
	ID            string
	UserID        string
	SkillKey      string
	Score         int
	Confidence    int
	AttemptsCount int
	LastSeenAt    *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Recommendation is a user-facing suggestion.
type Recommendation struct {
	ID          string
	UserID      string
	Type        string
	Priority    string
	SkillKey    *string
	Title       string
	Description string
	Status      string
	Metadata    map[string]any
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DismissedAt *time.Time
	CompletedAt *time.Time
}

// LearningPlanItem is an actionable learning task.
type LearningPlanItem struct {
	ID               string
	UserID           string
	RecommendationID *string
	Type             string
	TaskID           *string
	SkillKey         *string
	Title            string
	Description      *string
	Status           string
	Position         int
	Metadata         map[string]any
	CreatedAt        time.Time
	UpdatedAt        time.Time
	CompletedAt      *time.Time
}

// SessionCompletedEvent is the interview session_completed outbox payload.
type SessionCompletedEvent struct {
	SessionID  string
	UserID     string
	Mode       string
	TotalScore float64
	OccurredAt time.Time
}

// RetryItemCreatedEvent is the interview retry_item_created outbox payload.
type RetryItemCreatedEvent struct {
	RetryItemID string
	UserID      string
	TaskID      string
	AttemptID   string
	OccurredAt  time.Time
}

// TaskSkippedEvent is the interview task_skipped outbox payload.
type TaskSkippedEvent struct {
	SessionTaskID string
	SessionID     string
	TaskID        string
	UserID        string
	Mode          string
	OccurredAt    time.Time
}

// AttemptEvaluatedEvent is the interview outbox payload.
type AttemptEvaluatedEvent struct {
	AttemptID    string
	UserID       string
	TaskID       string
	SessionID    string
	TaskType     string
	Criteria     []any
	Score        float64
	Passed       bool
	OccurredAt   time.Time
}

// CriterionScore is a parsed evaluation criterion.
type CriterionScore struct {
	Key      string
	Score    float64
	MaxScore float64
	TaskType string
	SkillKey string
	Normalized int
}

// SkillInsight is a computed strength or weakness.
type SkillInsight struct {
	SkillKey   string
	Score      int
	Confidence int
}

// Dashboard aggregates user recommendation state.
type Dashboard struct {
	ReadinessScore    int
	ProfileSummary    *string
	Strengths         []SkillInsight
	Weaknesses        []SkillInsight
	Recommendations   []Recommendation
	LearningPlan      []LearningPlanItem
	PendingRetryCount int
}

// DashboardSnapshot is postgres-backed dashboard data.
type DashboardSnapshot struct {
	Profile         *UserSkillProfile
	SkillScores     []SkillScore
	Recommendations []Recommendation
	LearningPlan    []LearningPlanItem
}
