package plan

import (
	"fmt"
	"strings"

	contentadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/copy"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/pkg/classify"
)

const maxDesiredTasks = 20
const maxStaleModeTasks = 4

type BuildDesiredInput struct {
	Lang              string
	Readiness         int
	Weaknesses        []model.SkillInsight
	Recommendations   []model.Recommendation
	PendingRetries    []interviewadapter.RetryItem
	RetryTaskTitles   map[string]string
	ArticlesBySkill   map[string]contentadapter.Article
	ReadSlugs         map[string]struct{}
	StaleModes        []model.StalePracticeMode
}

func BuildDesiredTasks(in BuildDesiredInput) []DesiredTask {
	out := make([]DesiredTask, 0, maxDesiredTasks)
	coveredSkills := map[string]struct{}{}

	for _, retry := range in.PendingRetries {
		if len(out) >= maxDesiredTasks {
			break
		}
		taskTitle := in.RetryTaskTitles[retry.TaskID]
		dedup := "retry:" + retry.ID
		out = append(out, DesiredTask{
			DedupKey:     dedup,
			Title:        copy.RetryTaskTitle(in.Lang, taskTitle),
			EpicName:     EpicRetries,
			EstimateDays: EstimateRetry,
			Source:       "recommendation",
			BriefType:    "retry",
			Metadata: map[string]any{
				"task_kind":         classify.KindSystem,
				"brief_type":        "retry",
				"retry_item_id": retry.ID,
				"task_id":       retry.TaskID,
			},
		})
	}

	for i, stale := range in.StaleModes {
		if i >= maxStaleModeTasks || len(out) >= maxDesiredTasks {
			break
		}
		soloID := soloIDFromSessionMode(stale.SessionMode)
		if soloID == "" {
			continue
		}
		path := fmt.Sprintf("/mock?solo=%s&scope=review", soloID)
		dedup := "stale:" + stale.SessionMode
		out = append(out, DesiredTask{
			DedupKey:     dedup,
			Title:        copy.BriefStaleModeTitle(in.Lang, sectionLabelFromMode(stale.SessionMode)),
			EpicName:     EpicReview,
			EstimateDays: EstimateStaleReview,
			Source:       "recommendation",
			BriefType:    "review",
			Metadata: map[string]any{
				"task_kind":           classify.KindSystem,
				"brief_type":          "review",
				"session_mode":        stale.SessionMode,
				"action_path":         path,
				"days_since_practice": float64(stale.DaysSince),
			},
		})
	}

	for _, w := range in.Weaknesses {
		if len(out) >= maxDesiredTasks {
			break
		}
		if _, seen := coveredSkills[w.SkillKey]; seen {
			continue
		}
		coveredSkills[w.SkillKey] = struct{}{}
		skillKey := w.SkillKey

		if article, ok := in.ArticlesBySkill[w.SkillKey]; ok {
			if _, read := in.ReadSlugs[article.Slug]; read {
				dedup := "practice:" + skillKey
				out = append(out, DesiredTask{
					DedupKey:     dedup,
					Title:        copy.BriefPracticeAfterReadTitle(in.Lang, humanizeSkillKey(w.SkillKey)),
					EpicName:     EpicSkills,
					EstimateDays: EstimateWeakSkill,
					Source:       "recommendation",
					BriefType:    "skill",
					Metadata: map[string]any{
						"task_kind":    classify.KindSystem,
						"brief_type":   "skill",
						"skill_key":    skillKey,
						"action_path":  practicePathForSkill(w.SkillKey),
						"skill_score":  w.Score,
					},
				})
				continue
			}
			dedup := "read:" + article.Slug
			practicePath := practicePathForSkill(w.SkillKey)
			out = append(out, DesiredTask{
				DedupKey:     dedup,
				Title:        copy.BriefReadArticleTitle(in.Lang, article.Title),
				EpicName:     EpicLearning,
				EstimateDays: EstimateReadArticle,
				Source:       "recommendation",
				BriefType:    "learning",
				Metadata: map[string]any{
					"task_kind":              classify.KindSystem,
					"brief_type":             "learning",
					"article_slug":           article.Slug,
					"skill_key":              skillKey,
					"action_path":            fmt.Sprintf("/learn/%s", article.Slug),
					"secondary_action_path":  practicePath,
					"skill_score":            w.Score,
				},
			})
			continue
		}

		dedup := "practice:" + skillKey
		out = append(out, DesiredTask{
			DedupKey:     dedup,
			Title:        copy.BriefWeakSkillTitle(in.Lang, humanizeSkillKey(w.SkillKey)),
			EpicName:     EpicSkills,
			EstimateDays: EstimateWeakSkill,
			Source:       "recommendation",
			BriefType:    "skill",
			Metadata: map[string]any{
				"task_kind":   classify.KindSystem,
				"brief_type":  "skill",
				"skill_key":   skillKey,
				"action_path": "/mock",
				"skill_score": w.Score,
			},
		})
	}

	for _, rec := range in.Recommendations {
		if len(out) >= maxDesiredTasks {
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
		dedup := "rec:" + rec.ID
		meta := map[string]any{
			"task_kind":         classify.KindSystem,
			"recommendation_id": rec.ID,
			"rec_type":          string(rec.Type),
			"rec_priority":      string(rec.Priority),
		}
		epic := EpicSkills
		est := EstimateImproveSkill
		briefType := "skill"
		if rec.Type == model.RecommendationTypeTakeMockInterview {
			epic = EpicMock
			est = EstimateTakeMock
			briefType = "mock"
			meta["action_path"] = "/mock"
		} else if rec.SkillKey != nil {
			meta["skill_key"] = *rec.SkillKey
			meta["action_path"] = recommendationActionPath(rec.Type)
		} else {
			meta["action_path"] = recommendationActionPath(rec.Type)
		}
		meta["brief_type"] = briefType
		out = append(out, DesiredTask{
			DedupKey:     dedup,
			Title:        rec.Title,
			EpicName:     epic,
			EstimateDays: est,
			Source:       "recommendation",
			BriefType:    briefType,
			Metadata:     meta,
		})
	}

	if len(out) < maxDesiredTasks && in.Readiness >= 80 && !hasRecommendationType(in.Recommendations, model.RecommendationTypeTakeMockInterview) {
		out = append(out, DesiredTask{
			DedupKey:     "mock:take",
			Title:        copy.TakeMockTitle(in.Lang),
			EpicName:     EpicMock,
			EstimateDays: EstimateTakeMock,
			Source:       "recommendation",
			BriefType:    "mock",
			Metadata: map[string]any{
				"task_kind":   classify.KindSystem,
				"brief_type":  "mock",
				"action_path": "/mock",
			},
		})
	}

	if len(out) == 0 {
		out = append(out, DesiredTask{
			DedupKey:     "mock:start",
			Title:        copy.BriefStartMockTitle(in.Lang),
			EpicName:     EpicMock,
			EstimateDays: EstimateTakeMock,
			Source:       "recommendation",
			BriefType:    "mock",
			Metadata: map[string]any{
				"task_kind":   classify.KindSystem,
				"brief_type":  "mock",
				"action_path": "/mock",
			},
		})
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

func soloIDFromSessionMode(mode string) string {
	switch mode {
	case "algorithms_training":
		return "algo"
	case "live_coding_training":
		return "live"
	case "system_design_training":
		return "system"
	case "behavioral_training":
		return "behavioral"
	default:
		return ""
	}
}

func sectionLabelFromMode(mode string) string {
	switch mode {
	case "algorithms_training":
		return "Algorithms"
	case "live_coding_training":
		return "Live coding"
	case "system_design_training":
		return "System design"
	case "behavioral_training":
		return "Behavioral"
	default:
		if mode == "" {
			return ""
		}
		return mode
	}
}

func practicePathForSkill(skillKey string) string {
	key := strings.ToLower(strings.TrimSpace(skillKey))
	switch {
	case strings.HasPrefix(key, "algorithm."):
		return "/mock?solo=algo"
	case strings.HasPrefix(key, "behavioral."):
		return "/mock?solo=behavioral"
	case strings.HasPrefix(key, "system"), strings.HasPrefix(key, "sysdesign"):
		return "/mock?solo=sysdesign"
	case strings.HasPrefix(key, "coding."), strings.HasPrefix(key, "live_coding"):
		return "/mock?solo=coding"
	default:
		return "/mock"
	}
}

func humanizeSkillKey(key string) string {
	if key == "" {
		return key
	}
	key = strings.ReplaceAll(key, ".", " ")
	key = strings.ReplaceAll(key, "_", " ")
	if len(key) == 1 {
		return strings.ToUpper(key)
	}
	return strings.ToUpper(key[:1]) + key[1:]
}
