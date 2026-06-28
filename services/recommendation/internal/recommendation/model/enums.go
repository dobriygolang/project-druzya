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

// DailyBriefItemType classifies one actionable Today brief row.
type DailyBriefItemType string

const (
	DailyBriefItemTypeRetryTask      DailyBriefItemType = "retry_task"
	DailyBriefItemTypeWeakSkill      DailyBriefItemType = "weak_skill"
	DailyBriefItemTypeRecommendation DailyBriefItemType = "recommendation"
	DailyBriefItemTypeTakeMock       DailyBriefItemType = "take_mock"
	DailyBriefItemTypeStartMock      DailyBriefItemType = "start_mock"
	DailyBriefItemTypeReadArticle       DailyBriefItemType = "read_article"
	DailyBriefItemTypePracticeStaleMode DailyBriefItemType = "practice_stale_mode"
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
