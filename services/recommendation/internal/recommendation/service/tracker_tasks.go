package service

import (
	"context"
	"strings"

	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/plan"
	"github.com/sedorofeevd/project-druzya/services/tracker/pkg/classify"
)

func (s *recommendationService) pushTrackerTask(ctx context.Context, params trackeradapter.CreateTaskParams) {
	if s.tracker == nil {
		return
	}
	if params.DedupKey == nil || strings.TrimSpace(*params.DedupKey) == "" {
		return // planner only writes dedup-keyed system tasks; never touch user backlog
	}
	if params.EpicName != nil && s.isEpicDeferredForSprint(ctx, params.UserID, *params.EpicName) {
		return
	}
	if _, err := s.tracker.CreateTaskInternal(ctx, params); err != nil {
		_ = err // best-effort; tracker must not block interview outbox
	}
}

func (s *recommendationService) isEpicDeferredForSprint(ctx context.Context, userID, epicName string) bool {
	if strings.TrimSpace(epicName) == "" {
		return false
	}
	settings, err := s.tracker.GetUserSettings(ctx, userID)
	if err != nil || settings == nil {
		return false
	}
	return plan.IsEpicDeferred(epicName, settings.DeferredSprintEpicNames)
}

func retryTrackerDedup(retryItemID string) string {
	return "retry:" + retryItemID
}

func recommendationTrackerDedup(id string) string {
	return "rec:" + id
}

func (s *recommendationService) pushRetryTrackerTask(ctx context.Context, userID, title, retryItemID, taskID string) {
	dedup := retryTrackerDedup(retryItemID)
	epic := plan.EpicRetries
	est := plan.EstimateRetry
	s.pushTrackerTask(ctx, trackeradapter.CreateTaskParams{
		UserID: userID,
		Title:  title,
		Source: "recommendation",
		Metadata: map[string]any{
			"task_kind":     classify.KindSystem,
			"brief_type":    "retry",
			"retry_item_id": retryItemID,
			"task_id":       taskID,
		},
		DedupKey:     &dedup,
		EpicName:     &epic,
		EstimateDays: &est,
	})
}

func (s *recommendationService) pushRecommendationTrackerTask(ctx context.Context, userID, title, recID string, recType string, priority string, meta map[string]any) {
	if meta == nil {
		meta = map[string]any{}
	}
	meta["recommendation_id"] = recID
	meta["task_kind"] = classify.KindSystem
	meta["rec_type"] = recType
	meta["rec_priority"] = priority
	epic := plan.EpicSkills
	est := plan.EstimateImproveSkill
	briefType := "skill"
	if recType == string(model.RecommendationTypeTakeMockInterview) {
		epic = plan.EpicMock
		est = plan.EstimateTakeMock
		briefType = "mock"
		if meta["action_path"] == nil {
			meta["action_path"] = "/mock"
		}
	}
	meta["brief_type"] = briefType
	dedup := recommendationTrackerDedup(recID)
	s.pushTrackerTask(ctx, trackeradapter.CreateTaskParams{
		UserID:       userID,
		Title:        title,
		Source:       "recommendation",
		Metadata:     meta,
		DedupKey:     &dedup,
		EpicName:     &epic,
		EstimateDays: &est,
	})
}
