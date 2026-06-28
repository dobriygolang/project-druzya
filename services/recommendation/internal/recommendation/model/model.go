package model

import "time"

const (
	ConsumerAttemptEvaluated = "recommendation.attempt_evaluated"
	ConsumerSessionCompleted = "recommendation.session_completed"
	ConsumerRetryItemCreated = "recommendation.retry_item_created"
	ConsumerTaskSkipped      = "recommendation.task_skipped"
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
	Type        RecommendationType
	Priority    RecommendationPriority
	SkillKey    *string
	Title       string
	Description string
	Status      RecommendationStatus
	Metadata    map[string]any
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DismissedAt *time.Time
	CompletedAt *time.Time
}

// SessionCompletedEvent is the interview session_completed outbox payload.
type SessionCompletedEvent struct {
	SessionID    string
	UserID       string
	Mode         string
	TemplateID   *string
	TotalScore   float64
	Outcome      string
	PassingScore int
	OccurredAt   time.Time
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
	AttemptID  string
	UserID     string
	TaskID     string
	SessionID  string
	TaskType   string
	Mode       string
	TemplateID *string
	Criteria   []any
	Score      float64
	Passed     bool
	OccurredAt time.Time
}

// UserTaskProgress tracks per-task mock practice outcomes for a user.
type UserTaskProgress struct {
	UserID        string
	TaskID        string
	TaskType      string
	BestScore     int
	Passed        bool
	AttemptsCount int
	FirstPassedAt *time.Time
	LastPassedAt  *time.Time
	LastAttemptAt time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// UserTemplateProgress tracks company mock template outcomes for a user.
type UserTemplateProgress struct {
	UserID         string
	TemplateID     string
	BestTotalScore int
	Passed         bool
	AttemptsCount  int
	LastPassedAt   *time.Time
	LastSessionID  *string
	LastAttemptAt  time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// UserPracticeModeActivity tracks last solo/training mode practice for a user.
type UserPracticeModeActivity struct {
	UserID           string
	SessionMode      string
	TaskType         string
	LastPracticedAt  time.Time
	PassedTasksCount int
	UpdatedAt        time.Time
}

// StalePracticeMode is a training mode the user has not practiced recently.
type StalePracticeMode struct {
	SessionMode     string
	TaskType        string
	LastPracticedAt *time.Time
	DaysSince       int
}

// ReviewTaskCandidate is a previously passed task due for spaced review.
type ReviewTaskCandidate struct {
	TaskID       string
	TaskType     string
	BestScore    int
	LastPassedAt time.Time
}

// TaskTypeCoverage summarizes task progress for one task type.
type TaskTypeCoverage struct {
	TaskType      string
	PassedCount   int
	AttemptsCount int
}

// TaskPickerHints supports interview task selection UI.
type TaskPickerHints struct {
	PassedTaskIDs    []string
	ReviewCandidates []ReviewTaskCandidate
}

// MockHubContext aggregates mock hub progress for the web client.
type MockHubContext struct {
	StaleModes         []StalePracticeMode
	TemplateProgress   []UserTemplateProgress
	TaskTypeCoverage   []TaskTypeCoverage
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

// DailyBriefItem is one actionable row on Today.
type DailyBriefItem struct {
	Type        DailyBriefItemType
	Title       string
	Description *string
	ActionLabel *string
	ActionPath  *string
	RetryItemID *string
	SkillKey    *string
	SecondaryActionLabel *string
	SecondaryActionPath  *string
}

// DailyBrief is a structured Today summary built by recommendation-service.
type DailyBrief struct {
	ReadinessScore int
	Items          []DailyBriefItem
}

// Dashboard aggregates user recommendation state.
type Dashboard struct {
	ReadinessScore    int
	DailyBrief        DailyBrief
	Strengths         []SkillInsight
	Weaknesses        []SkillInsight
	Recommendations   []Recommendation
	PendingRetryCount int
	ReadArticleSlugs  []string
}

// ArticleRead records that a user finished a knowledge-base article.
type ArticleRead struct {
	Slug   string
	ReadAt time.Time
}

// DashboardSnapshot is postgres-backed dashboard data.
type DashboardSnapshot struct {
	Profile         *UserSkillProfile
	SkillScores     []SkillScore
	Recommendations []Recommendation
}
