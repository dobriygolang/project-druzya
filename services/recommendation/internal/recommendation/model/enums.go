package model

import "fmt"

// RecommendationType classifies a user-facing suggestion.
type RecommendationType string

const (
	RecommendationTypeImproveSkill      RecommendationType = "improve_skill"
	RecommendationTypeRewriteAnswer     RecommendationType = "rewrite_answer"
	RecommendationTypePracticeSection   RecommendationType = "practice_section"
	RecommendationTypeTakeMockInterview RecommendationType = "take_mock_interview"
)

// RecommendationPriority ranks suggestion urgency.
type RecommendationPriority string

const (
	RecommendationPriorityHigh   RecommendationPriority = "high"
	RecommendationPriorityMedium RecommendationPriority = "medium"
	RecommendationPriorityLow    RecommendationPriority = "low"
)

// RecommendationStatus is lifecycle state of a recommendation row.
type RecommendationStatus string

const (
	RecommendationStatusActive    RecommendationStatus = "active"
	RecommendationStatusDismissed RecommendationStatus = "dismissed"
	RecommendationStatusCompleted RecommendationStatus = "completed"
)

// LearningPlanItemType classifies a learning plan row.
type LearningPlanItemType string

const (
	LearningPlanItemTypeRetryTask LearningPlanItemType = "retry_task"
)

// LearningPlanItemStatus is lifecycle state of a plan item.
type LearningPlanItemStatus string

const (
	LearningPlanItemStatusPending    LearningPlanItemStatus = "pending"
	LearningPlanItemStatusInProgress LearningPlanItemStatus = "in_progress"
	LearningPlanItemStatusCompleted  LearningPlanItemStatus = "completed"
	LearningPlanItemStatusDismissed  LearningPlanItemStatus = "dismissed"
)

// DailyBriefItemType classifies one actionable Today brief row.
type DailyBriefItemType string

const (
	DailyBriefItemTypeRetryTask      DailyBriefItemType = "retry_task"
	DailyBriefItemTypeWeakSkill      DailyBriefItemType = "weak_skill"
	DailyBriefItemTypeRecommendation DailyBriefItemType = "recommendation"
	DailyBriefItemTypeTakeMock       DailyBriefItemType = "take_mock"
	DailyBriefItemTypeStartMock      DailyBriefItemType = "start_mock"
	DailyBriefItemTypeReadArticle    DailyBriefItemType = "read_article"
)

// ParseRecommendationType validates a DB/API recommendation type string.
func ParseRecommendationType(v string) (RecommendationType, error) {
	t := RecommendationType(v)
	switch t {
	case RecommendationTypeImproveSkill,
		RecommendationTypeRewriteAnswer,
		RecommendationTypePracticeSection,
		RecommendationTypeTakeMockInterview:
		return t, nil
	default:
		return "", fmt.Errorf("invalid recommendation type %q", v)
	}
}

// ParseLearningPlanItemType validates a plan item type string.
func ParseLearningPlanItemType(v string) (LearningPlanItemType, error) {
	t := LearningPlanItemType(v)
	switch t {
	case LearningPlanItemTypeRetryTask:
		return t, nil
	default:
		return "", fmt.Errorf("invalid learning plan item type %q", v)
	}
}
