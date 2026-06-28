package service

import (
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/copy"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

const maxBriefItems = 5
const maxStaleModeBriefItems = 2

func buildDailyBrief(
	lang string,
	readiness int,
	weaknesses []model.SkillInsight,
	recommendations []model.Recommendation,
	pendingRetries []interviewadapter.RetryItem,
	retryTaskTitles map[string]string,
	articlesBySkill map[string]contentadapter.Article,
	readSlugs map[string]struct{},
	staleModes []model.StalePracticeMode,
) model.DailyBrief {
	items := make([]model.DailyBriefItem, 0, maxBriefItems)
	coveredSkills := map[string]struct{}{}

	for _, retry := range pendingRetries {
		if len(items) >= maxBriefItems {
			break
		}
		retryID := retry.ID
		taskTitle := retryTaskTitles[retry.TaskID]
		items = append(items, model.DailyBriefItem{
			Type:        model.DailyBriefItemTypeRetryTask,
			Title:       copy.RetryTaskTitle(lang, taskTitle),
			ActionLabel: strPtr(copy.BriefRetryAction(lang)),
			RetryItemID: &retryID,
		})
	}

	for i, stale := range staleModes {
		if i >= maxStaleModeBriefItems || len(items) >= maxBriefItems {
			break
		}
		soloID := soloIDFromSessionMode(stale.SessionMode)
		if soloID == "" {
			continue
		}
		path := fmt.Sprintf("/mock?solo=%s", soloID)
		desc := copy.BriefStaleModeDescription(lang, sectionLabelFromMode(stale.SessionMode), stale.DaysSince)
		action := copy.BriefPracticeAction(lang)
		items = append(items, model.DailyBriefItem{
			Type:        model.DailyBriefItemTypePracticeStaleMode,
			Title:       copy.BriefStaleModeTitle(lang, sectionLabelFromMode(stale.SessionMode)),
			Description: &desc,
			ActionLabel: &action,
			ActionPath:  &path,
		})
	}

	for _, w := range weaknesses {
		if len(items) >= maxBriefItems {
			break
		}
		if _, seen := coveredSkills[w.SkillKey]; seen {
			continue
		}
		coveredSkills[w.SkillKey] = struct{}{}
		skillKey := w.SkillKey

		if article, ok := articlesBySkill[w.SkillKey]; ok {
			if _, read := readSlugs[article.Slug]; read {
				desc := copy.BriefPracticeAfterReadDescription(lang, article.Title)
				action := copy.BriefPracticeAction(lang)
				path := practicePathForSkill(w.SkillKey)
				items = append(items, model.DailyBriefItem{
					Type:        model.DailyBriefItemTypeWeakSkill,
					Title:       copy.BriefPracticeAfterReadTitle(lang, humanizeSkillKey(w.SkillKey)),
					Description: &desc,
					ActionLabel: &action,
					ActionPath:  &path,
					SkillKey:    &skillKey,
				})
				continue
			}
			desc := article.Summary
			action := copy.BriefReadArticleAction(lang)
			path := fmt.Sprintf("/learn/%s", article.Slug)
			practiceAction := copy.BriefPracticeAction(lang)
			practicePath := practicePathForSkill(w.SkillKey)
			items = append(items, model.DailyBriefItem{
				Type:                 model.DailyBriefItemTypeReadArticle,
				Title:                copy.BriefReadArticleTitle(lang, article.Title),
				Description:          &desc,
				ActionLabel:          &action,
				ActionPath:           &path,
				SkillKey:             &skillKey,
				SecondaryActionLabel: &practiceAction,
				SecondaryActionPath:  &practicePath,
			})
			continue
		}

		desc := copy.BriefWeakSkillDescription(lang, humanizeSkillKey(w.SkillKey), w.Score)
		action := copy.BriefPracticeAction(lang)
		items = append(items, model.DailyBriefItem{
			Type:        model.DailyBriefItemTypeWeakSkill,
			Title:       copy.BriefWeakSkillTitle(lang, humanizeSkillKey(w.SkillKey)),
			Description: &desc,
			ActionLabel: &action,
			ActionPath:  strPtr("/mock"),
			SkillKey:    &skillKey,
		})
	}

	for _, rec := range recommendations {
		if len(items) >= maxBriefItems {
			break
		}
		if rec.Status != model.RecommendationStatusActive {
			continue
		}
		if rec.Type == model.RecommendationTypeImproveSkill && rec.SkillKey != nil {
			if _, seen := coveredSkills[*rec.SkillKey]; seen {
				continue
			}
		}
		desc := rec.Description
		action := copy.BriefRecommendationAction(lang, rec.Type)
		items = append(items, model.DailyBriefItem{
			Type:        model.DailyBriefItemTypeRecommendation,
			Title:       rec.Title,
			Description: &desc,
			ActionLabel: &action,
			ActionPath:  strPtr(recommendationActionPath(rec.Type)),
			SkillKey:    rec.SkillKey,
		})
	}

	if len(items) < maxBriefItems && readiness >= 80 && !hasRecommendationType(recommendations, model.RecommendationTypeTakeMockInterview) {
		title := copy.TakeMockTitle(lang)
		desc := copy.TakeMockDescription(lang, readiness)
		action := copy.BriefTakeMockAction(lang)
		items = append(items, model.DailyBriefItem{
			Type:        model.DailyBriefItemTypeTakeMock,
			Title:       title,
			Description: &desc,
			ActionLabel: &action,
			ActionPath:  strPtr("/mock"),
		})
	}

	if len(items) == 0 {
		title := copy.BriefStartMockTitle(lang)
		desc := copy.BriefStartMockDescription(lang)
		action := copy.BriefTakeMockAction(lang)
		items = append(items, model.DailyBriefItem{
			Type:        model.DailyBriefItemTypeStartMock,
			Title:       title,
			Description: &desc,
			ActionLabel: &action,
			ActionPath:  strPtr("/mock"),
		})
	}

	return model.DailyBrief{
		ReadinessScore: readiness,
		Items:          items,
	}
}

func indexArticlesBySkill(articles []contentadapter.Article) map[string]contentadapter.Article {
	out := make(map[string]contentadapter.Article, len(articles))
	for _, article := range articles {
		for _, skillKey := range article.SkillKeys {
			if _, exists := out[skillKey]; !exists {
				out[skillKey] = article
			}
		}
	}
	return out
}

func hasRecommendationType(recs []model.Recommendation, recType model.RecommendationType) bool {
	for _, rec := range recs {
		if rec.Status == model.RecommendationStatusActive && rec.Type == recType {
			return true
		}
	}
	return false
}

func recommendationActionPath(recType model.RecommendationType) string {
	switch recType {
	case model.RecommendationTypeTakeMockInterview,
		model.RecommendationTypeImproveSkill,
		model.RecommendationTypePracticeSection,
		model.RecommendationTypeRewriteAnswer:
		return "/mock"
	default:
		return "/mock"
	}
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
