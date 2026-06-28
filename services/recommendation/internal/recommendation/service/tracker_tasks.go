package service

import (
	"context"
	"fmt"

	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	"github.com/sedorofeevd/project-druzya/services/tracker/pkg/classify"
)

func (s *recommendationService) pushTrackerTask(ctx context.Context, params trackeradapter.CreateTaskParams) {
	if s.tracker == nil {
		return
	}
	if _, err := s.tracker.CreateTaskInternal(ctx, params); err != nil {
		_ = err // best-effort; tracker must not block interview outbox
	}
}

func retryTrackerDedup(retryItemID string) string {
	return "retry:" + retryItemID
}

func recommendationTrackerDedup(id string) string {
	return "rec:" + id
}

func articleTrackerDedup(slug string) string {
	return "article:" + slug
}

func (s *recommendationService) pushRetryTrackerTask(ctx context.Context, userID, title, retryItemID, taskID string) {
	dedup := retryTrackerDedup(retryItemID)
	s.pushTrackerTask(ctx, trackeradapter.CreateTaskParams{
		UserID: userID,
		Title:  title,
		Source: "recommendation",
		Metadata: map[string]any{
			"task_kind":     classify.KindSystem,
			"retry_item_id": retryItemID,
			"task_id":       taskID,
		},
		DedupKey: &dedup,
	})
}

func (s *recommendationService) pushRecommendationTrackerTask(ctx context.Context, userID, title, recID string, meta map[string]any) {
	if meta == nil {
		meta = map[string]any{}
	}
	meta["recommendation_id"] = recID
	meta["task_kind"] = classify.KindSystem
	dedup := recommendationTrackerDedup(recID)
	s.pushTrackerTask(ctx, trackeradapter.CreateTaskParams{
		UserID: userID, Title: title, Source: "recommendation", Metadata: meta, DedupKey: &dedup,
	})
}

func (s *recommendationService) pushArticleTrackerTask(ctx context.Context, userID, title, slug, skillKey string) {
	dedup := articleTrackerDedup(slug)
	path := fmt.Sprintf("/learn/%s", slug)
	s.pushTrackerTask(ctx, trackeradapter.CreateTaskParams{
		UserID: userID,
		Title:  title,
		Source: "recommendation",
		Metadata: map[string]any{
			"task_kind":    classify.KindSystem,
			"article_slug": slug,
			"skill_key":    skillKey,
			"action_path":  path,
		},
		DedupKey: &dedup,
	})
}
