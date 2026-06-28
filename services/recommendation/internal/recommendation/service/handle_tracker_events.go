package service

import (
	"context"
	"fmt"

	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	recommendationrepo "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/repository"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/copy"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/locale"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/payload"
	"github.com/sedorofeevd/project-druzya/services/tracker/pkg/classify"
)

const (
	ConsumerTrackerTaskCreated   = "recommendation.tracker_task_created"
	ConsumerTrackerTaskCompleted = "recommendation.tracker_task_completed"
)

func (s *recommendationService) HandleTrackerTaskCreated(ctx context.Context, eventID string, ev map[string]any) error {
	if s.tracker == nil {
		return nil
	}
	processed, err := s.repo.IsEventProcessed(ctx, ConsumerTrackerTaskCreated, eventID)
	if err != nil {
		return err
	}
	if processed {
		return nil
	}
	userID := payload.StringField(ev, "user_id")
	taskID := payload.StringField(ev, "task_id")
	title := payload.StringField(ev, "title")
	source := payload.StringField(ev, "source")
	if userID == "" || source != "user" {
		return nil
	}
	meta := map[string]any{}
	if raw, ok := ev["metadata"].(map[string]any); ok {
		meta = raw
	}
	kind, _ := meta["task_kind"].(string)
	if kind == "" {
		kind = classify.Title(title).Kind
		meta["task_kind"] = kind
	}
	if kind == classify.KindGeneral && s.tracker != nil {
		kind, meta = s.maybeSmartParseTask(ctx, userID, taskID, title, kind, meta)
	}
	if !classify.ShouldEnrich(kind) {
		return s.repo.WithTx(ctx, func(txCtx context.Context) error {
			claimed, err := s.repo.ClaimEvent(txCtx, ConsumerTrackerTaskCreated, eventID)
			if err != nil || !claimed {
				return err
			}
			return nil
		})
	}
	return s.repo.WithTx(ctx, func(txCtx context.Context) error {
		claimed, err := s.repo.ClaimEvent(txCtx, ConsumerTrackerTaskCreated, eventID)
		if err != nil || !claimed {
			return err
		}
		skillKey := classify.InferSkillKey(meta)
		if skillKey != "" {
			articles, err := s.content.ListArticlesBySkillKeys(txCtx, []string{skillKey})
			if err == nil && len(articles) > 0 {
				article := articles[0]
				lang := locale.From(ctx)
				readTitle := copy.BriefReadArticleTitle(lang, article.Title)
				s.pushTrackerTask(txCtx, trackeradapter.CreateTaskParams{
					UserID: userID,
					Title:  readTitle,
					Source: "enrichment",
					Metadata: map[string]any{
						"task_kind":      classify.KindSystem,
						"article_slug":   article.Slug,
						"skill_key":      skillKey,
						"action_path":    fmt.Sprintf("/learn/%s", article.Slug),
						"parent_task_id": taskID,
					},
					DedupKey: strPtr("enrich-read:" + taskID + ":" + article.Slug),
					EpicName: metaEpicName(meta),
				})
			}
			return s.maybePushWeakSkillPractice(txCtx, userID, skillKey)
		}
		return nil
	})
}

func (s *recommendationService) HandleTrackerTaskCompleted(ctx context.Context, eventID string, ev map[string]any) error {
	processed, err := s.repo.IsEventProcessed(ctx, ConsumerTrackerTaskCompleted, eventID)
	if err != nil {
		return err
	}
	if processed {
		return nil
	}
	userID := payload.StringField(ev, "user_id")
	if userID == "" {
		return nil
	}
	meta := map[string]any{}
	if raw, ok := ev["metadata"].(map[string]any); ok {
		meta = raw
	}
	return s.repo.WithTx(ctx, func(txCtx context.Context) error {
		claimed, err := s.repo.ClaimEvent(txCtx, ConsumerTrackerTaskCompleted, eventID)
		if err != nil || !claimed {
			return err
		}
		if slug, ok := meta["article_slug"].(string); ok && slug != "" {
			if _, err := s.repo.UpsertArticleRead(txCtx, userID, slug); err != nil {
				return err
			}
		}
		if recID, ok := meta["recommendation_id"].(string); ok && recID != "" {
			if err := s.repo.UpdateRecommendationStatus(txCtx, userID, recID, model.RecommendationStatusCompleted); err != nil {
				return err
			}
		}
		if retryID, ok := meta["retry_item_id"].(string); ok && retryID != "" && s.interview != nil {
			if _, err := s.interview.CompleteRetryItem(txCtx, userID, retryID); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *recommendationService) maybePushWeakSkillPractice(ctx context.Context, userID, skillKey string) error {
	score, err := s.repo.GetSkillScore(ctx, userID, skillKey)
	if err != nil {
		if err == recommendationrepo.ErrNotFound {
			return nil
		}
		return err
	}
	if score.Score >= 70 {
		return nil
	}
	lang := locale.From(ctx)
	title := copy.BriefWeakSkillTitle(lang, humanizeSkillKey(skillKey))
	dedup := "practice:" + skillKey
	s.pushTrackerTask(ctx, trackeradapter.CreateTaskParams{
		UserID: userID,
		Title:  title,
		Source: "enrichment",
		Metadata: map[string]any{
			"task_kind":   classify.KindSystem,
			"skill_key":   skillKey,
			"action_path": practicePathForSkill(skillKey),
		},
		DedupKey: &dedup,
	})
	return nil
}

func metaEpicName(meta map[string]any) *string {
	if book, ok := meta["book"].(string); ok && book != "" {
		return &book
	}
	if hint, ok := meta["epic_hint"].(string); ok && hint != "" {
		return &hint
	}
	return nil
}

func (s *recommendationService) maybeSmartParseTask(
	ctx context.Context,
	userID, taskID, title, kind string,
	meta map[string]any,
) (string, map[string]any) {
	if s.ai == nil || s.tracker == nil {
		return kind, meta
	}
	settings, err := s.tracker.GetUserSettings(ctx, userID)
	if err != nil || settings == nil || !settings.SmartParseEnabled {
		return kind, meta
	}
	result, err := s.ai.ClassifyTrackerTask(ctx, title)
	if err != nil || result == nil {
		return kind, meta
	}
	patch := map[string]any{}
	for k, v := range result.Metadata {
		patch[k] = v
	}
	if result.Kind != "" {
		patch["task_kind"] = result.Kind
	}
	if result.EpicHint != nil && *result.EpicHint != "" {
		patch["epic_hint"] = *result.EpicHint
	}
	if len(patch) == 0 {
		return kind, meta
	}
	if err := s.tracker.PatchTaskMetadata(ctx, userID, taskID, patch); err != nil {
		return kind, meta
	}
	for k, v := range patch {
		meta[k] = v
	}
	if k, ok := meta["task_kind"].(string); ok && k != "" {
		kind = k
	} else if result.Kind != "" {
		kind = result.Kind
		meta["task_kind"] = kind
	}
	return kind, meta
}
