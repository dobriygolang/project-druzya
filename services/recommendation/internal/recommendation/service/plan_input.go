package service

import (
	"context"
	"fmt"
	"time"

	contentadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/plan"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/locale"
)

func (s *recommendationService) loadPlanInput(ctx context.Context, userID string) (plan.BuildDesiredInput, error) {
	snap, err := s.repo.FetchDashboardSnapshot(ctx, userID)
	if err != nil {
		return plan.BuildDesiredInput{}, fmt.Errorf("fetch dashboard: %w", err)
	}
	pendingRetries, err := s.interview.ListPendingRetryItems(ctx, userID)
	if err != nil {
		return plan.BuildDesiredInput{}, fmt.Errorf("list pending retries: %w", err)
	}
	weaknesses := computeWeaknesses(snap.SkillScores)
	skillKeys := make([]string, 0, len(weaknesses))
	for _, w := range weaknesses {
		skillKeys = append(skillKeys, w.SkillKey)
	}
	var articles []contentadapter.Article
	if len(skillKeys) > 0 {
		articles, err = s.content.ListArticlesBySkillKeys(ctx, skillKeys)
		if err != nil {
			return plan.BuildDesiredInput{}, fmt.Errorf("list articles: %w", err)
		}
	}
	readSlugs, err := s.repo.ListArticleReadSlugs(ctx, userID)
	if err != nil {
		return plan.BuildDesiredInput{}, fmt.Errorf("list article reads: %w", err)
	}
	practiceActivity, err := s.repo.ListPracticeModeActivity(ctx, userID)
	if err != nil {
		return plan.BuildDesiredInput{}, fmt.Errorf("list practice mode activity: %w", err)
	}
	staleModes := computeStalePracticeModes(practiceActivity, time.Now().UTC())
	retryTaskTitles := map[string]string{}
	for _, retry := range pendingRetries {
		if retry.TaskID == "" {
			continue
		}
		if _, ok := retryTaskTitles[retry.TaskID]; ok {
			continue
		}
		task, err := s.content.GetTask(ctx, retry.TaskID)
		if err != nil || task == nil {
			continue
		}
		retryTaskTitles[retry.TaskID] = task.Title
	}
	return plan.BuildDesiredInput{
		Lang:            locale.From(ctx),
		Readiness:       snap.Profile.ReadinessScore,
		Weaknesses:      weaknesses,
		Recommendations: snap.Recommendations,
		PendingRetries:  pendingRetries,
		RetryTaskTitles: retryTaskTitles,
		ArticlesBySkill: indexArticlesBySkill(articles),
		ReadSlugs:       indexReadSlugs(readSlugs),
		StaleModes:      staleModes,
	}, nil
}
