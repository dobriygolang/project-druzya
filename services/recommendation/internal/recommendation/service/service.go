package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	contentadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	aiadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/ai"
	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/copy"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/locale"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/payload"
)

// ErrInvalidInput marks malformed handler input.
var ErrInvalidInput = errors.New("invalid input")

// Repository persists recommendation domain state.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Repository --output=./mocks --outpkg=mocks --filename=repository.go
type Repository interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	IsEventProcessed(ctx context.Context, consumer, eventID string) (bool, error)
	ClaimEvent(ctx context.Context, consumer, eventID string) (bool, error)
	EnsureUserProfile(ctx context.Context, userID string) error
	UpsertSkillScore(ctx context.Context, userID, skillKey string, normalized int, seenAt time.Time) (*model.SkillScore, error)
	GetSkillScore(ctx context.Context, userID, skillKey string) (*model.SkillScore, error)
	ListSkillScoresByUser(ctx context.Context, userID string) ([]model.SkillScore, error)
	UpdateReadinessScore(ctx context.Context, userID string, readiness int) error
	GetUserProfile(ctx context.Context, userID string) (*model.UserSkillProfile, error)
	UpsertImproveSkillRecommendation(ctx context.Context, rec model.Recommendation) (*model.Recommendation, error)
	InsertSpecialRecommendation(ctx context.Context, rec model.Recommendation) (*model.Recommendation, error)
	InsertTakeMockRecommendation(ctx context.Context, rec model.Recommendation) (*model.Recommendation, error)
	FetchDashboardSnapshot(ctx context.Context, userID string) (*model.DashboardSnapshot, error)
	ListActiveRecommendations(ctx context.Context, userID string) ([]model.Recommendation, error)
	GetRecommendation(ctx context.Context, userID, id string) (*model.Recommendation, error)
	UpdateRecommendationStatus(ctx context.Context, userID, id string, status model.RecommendationStatus) error
	ListArticleReadSlugs(ctx context.Context, userID string) ([]string, error)
	UpsertArticleRead(ctx context.Context, userID, slug string) (*model.ArticleRead, error)
	UpsertUserTaskProgress(ctx context.Context, userID, taskID, taskType string, score int, passed bool, seenAt time.Time) error
	ListPassedTaskIDsByType(ctx context.Context, userID, taskType string) ([]string, error)
	ListReviewTaskCandidates(ctx context.Context, userID, taskType string, staleAfter time.Time, limit int) ([]model.ReviewTaskCandidate, error)
	UpsertUserTemplateProgress(ctx context.Context, userID, templateID, sessionID string, totalScore, passingScore int, seenAt time.Time) error
	ListUserTemplateProgress(ctx context.Context, userID string) ([]model.UserTemplateProgress, error)
	UpsertPracticeModeActivity(ctx context.Context, userID, sessionMode, taskType string, passed bool, seenAt time.Time) error
	ListPracticeModeActivity(ctx context.Context, userID string) ([]model.UserPracticeModeActivity, error)
	ListTaskTypeCoverage(ctx context.Context, userID string) ([]model.TaskTypeCoverage, error)
}

// Service is the recommendation domain API.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Service --output=./mocks --outpkg=mocks --filename=service.go
type Service interface {
	HandleAttemptEvaluated(ctx context.Context, eventID string, event model.AttemptEvaluatedEvent) error
	HandleSessionCompleted(ctx context.Context, eventID string, event model.SessionCompletedEvent) error
	HandleRetryItemCreated(ctx context.Context, eventID string, event model.RetryItemCreatedEvent) error
	HandleTaskSkipped(ctx context.Context, eventID string, event model.TaskSkippedEvent) error
	HandleTrackerTaskCreated(ctx context.Context, eventID string, payload map[string]any) error
	HandleTrackerTaskCompleted(ctx context.Context, eventID string, payload map[string]any) error
	GetDashboard(ctx context.Context, userID string) (*model.Dashboard, error)
	DismissRecommendation(ctx context.Context, userID, id string) error
	CompleteRecommendation(ctx context.Context, userID, id string) error
	MarkArticleRead(ctx context.Context, userID, slug string) (*model.ArticleRead, error)
	GetTaskPickerHints(ctx context.Context, userID, taskType string) (*model.TaskPickerHints, error)
	GetMockHubContext(ctx context.Context, userID string) (*model.MockHubContext, error)
}

type recommendationService struct {
	repo      Repository
	interview interviewadapter.Client
	content   contentadapter.Client
	tracker   trackeradapter.Client
	ai        aiadapter.Client
}

// Deps wires recommendation service dependencies.
type Deps struct {
	Repo      Repository
	Interview interviewadapter.Client
	Content   contentadapter.Client
	Tracker   trackeradapter.Client
	AI        aiadapter.Client
}

// New constructs the recommendation service.
func New(deps Deps) Service {
	return &recommendationService{
		repo:      deps.Repo,
		interview: deps.Interview,
		content:   deps.Content,
		tracker:   deps.Tracker,
		ai:        deps.AI,
	}
}

func (s *recommendationService) HandleAttemptEvaluated(ctx context.Context, eventID string, event model.AttemptEvaluatedEvent) error {
	processed, err := s.repo.IsEventProcessed(ctx, model.ConsumerAttemptEvaluated, eventID)
	if err != nil {
		return fmt.Errorf("check event processed: %w", err)
	}
	if processed {
		return nil
	}

	taskType := event.TaskType
	if taskType == "" {
		if event.TaskID == "" {
			return fmt.Errorf("task_id missing in event: %w", ErrInvalidInput)
		}
		task, err := s.content.GetTask(ctx, event.TaskID)
		if err != nil {
			return fmt.Errorf("get task: %w", err)
		}
		taskType = task.Type
	}

	var criteria []model.CriterionScore
	var summarySeenAt time.Time
	if len(event.Criteria) > 0 {
		criteria = parseCriteria(map[string]any{"criteria": event.Criteria}, taskType, event.Score)
	} else {
		summary, err := s.interview.GetEvaluationSummary(ctx, event.AttemptID)
		if err != nil {
			return fmt.Errorf("get evaluation summary: %w", err)
		}
		criteria = parseCriteria(summary.Feedback, taskType, event.Score)
		summarySeenAt = summary.CreatedAt
	}

	seenAt := event.OccurredAt
	if seenAt.IsZero() {
		seenAt = summarySeenAt
	}

	if err := s.repo.WithTx(ctx, func(txCtx context.Context) error {
		// Authoritative idempotency guard: only the caller that claims the event
		// inside the transaction proceeds; concurrent duplicates no-op.
		claimed, err := s.repo.ClaimEvent(txCtx, model.ConsumerAttemptEvaluated, eventID)
		if err != nil {
			return fmt.Errorf("claim event: %w", err)
		}
		if !claimed {
			return nil
		}

		if err := s.repo.EnsureUserProfile(txCtx, event.UserID); err != nil {
			return fmt.Errorf("ensure user profile: %w", err)
		}

		scoreInt := normalizeScore(event.Score, 100)
		if err := s.repo.UpsertUserTaskProgress(txCtx, event.UserID, event.TaskID, taskType, scoreInt, event.Passed, seenAt); err != nil {
			return fmt.Errorf("upsert user task progress: %w", err)
		}
		if event.Mode != "" {
			if err := s.repo.UpsertPracticeModeActivity(txCtx, event.UserID, event.Mode, taskType, event.Passed, seenAt); err != nil {
				return fmt.Errorf("upsert practice mode activity: %w", err)
			}
		}

		lang := locale.From(ctx)

		for _, c := range criteria {
			if _, err := s.repo.UpsertSkillScore(txCtx, event.UserID, c.SkillKey, c.Normalized, seenAt); err != nil {
				return fmt.Errorf("upsert skill score %s: %w", c.SkillKey, err)
			}
		}

		scores, err := s.repo.ListSkillScoresByUser(txCtx, event.UserID)
		if err != nil {
			return fmt.Errorf("list skill scores: %w", err)
		}
		readiness := calculateReadiness(scores)
		if err := s.repo.UpdateReadinessScore(txCtx, event.UserID, readiness); err != nil {
			return fmt.Errorf("update readiness: %w", err)
		}

		for _, c := range criteria {
			if c.Normalized < 70 {
				skillKey := c.SkillKey
				rec := model.Recommendation{
					UserID:      event.UserID,
					Type:        model.RecommendationTypeImproveSkill,
					Priority:    priorityForScore(c.Normalized),
					SkillKey:    &skillKey,
					Title:       copy.ImproveSkillTitle(lang, humanizeSkillKey(c.SkillKey)),
					Description: copy.ImproveSkillDescription(lang, humanizeSkillKey(c.SkillKey), c.Normalized),
					Metadata: map[string]any{
						"attempt_id": event.AttemptID,
						"score":      c.Normalized,
					},
				}
				inserted, err := s.repo.UpsertImproveSkillRecommendation(txCtx, rec)
				if err != nil {
					return fmt.Errorf("upsert improve skill recommendation: %w", err)
				}
				if inserted != nil {
					dedup := "improve:" + skillKey
					s.pushTrackerTask(txCtx, trackeradapter.CreateTaskParams{
						UserID: event.UserID,
						Title:  rec.Title,
						Source: "recommendation",
						Metadata: map[string]any{
							"recommendation_id": inserted.ID,
							"skill_key":         skillKey,
							"action_path":       practicePathForSkill(skillKey),
						},
						DedupKey: &dedup,
					})
				}
			}
			if err := s.applySpecialRules(txCtx, event, c, lang); err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}

func (s *recommendationService) applySpecialRules(ctx context.Context, event model.AttemptEvaluatedEvent, c model.CriterionScore, lang string) error {
	if c.Normalized >= 70 {
		return nil
	}

	taskType := strings.ToLower(c.TaskType)
	criterionKey := strings.ToLower(c.Key)

	switch {
	case taskType == "behavioral" && criterionKey == "star_structure":
		skillKey := c.SkillKey
		rec := model.Recommendation{
			UserID:      event.UserID,
			Type:        model.RecommendationTypeRewriteAnswer,
			Priority:    priorityForScore(c.Normalized),
			SkillKey:    &skillKey,
			Title:       copy.RewriteAnswerTitle(lang),
			Description: copy.RewriteAnswerDescription(lang),
			Metadata: map[string]any{
				"attempt_id": event.AttemptID,
				"criterion":  c.Key,
			},
		}
		if _, err := s.repo.InsertSpecialRecommendation(ctx, rec); err != nil {
			return fmt.Errorf("insert rewrite_answer recommendation: %w", err)
		}
	case taskType == "system_design" && (criterionKey == "scalability" || criterionKey == "tradeoffs"):
		skillKey := c.SkillKey
		rec := model.Recommendation{
			UserID:      event.UserID,
			Type:        model.RecommendationTypePracticeSection,
			Priority:    priorityForScore(c.Normalized),
			SkillKey:    &skillKey,
			Title:       copy.PracticeSystemDesignTitle(lang, humanizeSkillKey(criterionKey)),
			Description: copy.PracticeSystemDesignDescription(lang, humanizeSkillKey(criterionKey), c.Normalized),
			Metadata: map[string]any{
				"attempt_id": event.AttemptID,
				"criterion":  c.Key,
			},
		}
		if _, err := s.repo.InsertSpecialRecommendation(ctx, rec); err != nil {
			return fmt.Errorf("insert practice_section recommendation: %w", err)
		}
	}
	return nil
}

func (s *recommendationService) GetDashboard(ctx context.Context, userID string) (*model.Dashboard, error) {
	snap, err := s.repo.FetchDashboardSnapshot(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("fetch dashboard: %w", err)
	}

	pendingRetries, err := s.interview.ListPendingRetryItems(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list pending retries: %w", err)
	}

	weaknesses := computeWeaknesses(snap.SkillScores)
	skillKeys := make([]string, 0, len(weaknesses))
	for _, w := range weaknesses {
		skillKeys = append(skillKeys, w.SkillKey)
	}
	articles, err := s.content.ListArticlesBySkillKeys(ctx, skillKeys)
	if err != nil {
		return nil, fmt.Errorf("list articles: %w", err)
	}

	readSlugs, err := s.repo.ListArticleReadSlugs(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list article reads: %w", err)
	}

	practiceActivity, err := s.repo.ListPracticeModeActivity(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list practice mode activity: %w", err)
	}
	staleModes := computeStalePracticeModes(practiceActivity, time.Now().UTC())

	retryTaskTitles := make(map[string]string, len(pendingRetries))
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

	lang := locale.From(ctx)
	brief := buildDailyBrief(
		lang,
		snap.Profile.ReadinessScore,
		weaknesses,
		snap.Recommendations,
		pendingRetries,
		retryTaskTitles,
		indexArticlesBySkill(articles),
		indexReadSlugs(readSlugs),
		staleModes,
	)

	return &model.Dashboard{
		ReadinessScore:    snap.Profile.ReadinessScore,
		DailyBrief:        brief,
		Strengths:         computeStrengths(snap.SkillScores),
		Weaknesses:        weaknesses,
		Recommendations:   snap.Recommendations,
		PendingRetryCount: len(pendingRetries),
		ReadArticleSlugs:  readSlugs,
	}, nil
}

func (s *recommendationService) DismissRecommendation(ctx context.Context, userID, id string) error {
	return s.repo.UpdateRecommendationStatus(ctx, userID, id, model.RecommendationStatusDismissed)
}

func (s *recommendationService) CompleteRecommendation(ctx context.Context, userID, id string) error {
	return s.repo.UpdateRecommendationStatus(ctx, userID, id, model.RecommendationStatusCompleted)
}

func parseCriteria(feedback map[string]any, taskType string, overallScore float64) []model.CriterionScore {
	raw, ok := feedback["criteria"]
	if !ok || raw == nil {
		return []model.CriterionScore{overallCriterion(taskType, overallScore)}
	}

	items, ok := raw.([]any)
	if !ok || len(items) == 0 {
		return []model.CriterionScore{overallCriterion(taskType, overallScore)}
	}

	out := make([]model.CriterionScore, 0, len(items))
	for _, item := range items {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		key := payload.StringField(m, "key")
		if key == "" {
			continue
		}
		cTaskType := payload.StringField(m, "task_type")
		if cTaskType == "" {
			cTaskType = taskType
		}
		score := payload.FloatField(m, "score")
		maxScore := payload.FloatField(m, "max_score")
		if maxScore <= 0 {
			maxScore = 100
		}
		skillKey := cTaskType + "." + key
		out = append(out, model.CriterionScore{
			Key:        key,
			Score:      score,
			MaxScore:   maxScore,
			TaskType:   cTaskType,
			SkillKey:   skillKey,
			Normalized: normalizeScore(score, maxScore),
		})
	}

	if len(out) == 0 {
		return []model.CriterionScore{overallCriterion(taskType, overallScore)}
	}
	return out
}

func overallCriterion(taskType string, overallScore float64) model.CriterionScore {
	skillKey := taskType + ".overall"
	return model.CriterionScore{
		Key:        "overall",
		Score:      overallScore,
		MaxScore:   100,
		TaskType:   taskType,
		SkillKey:   skillKey,
		Normalized: normalizeScore(overallScore, 100),
	}
}

func calculateReadiness(scores []model.SkillScore) int {
	var weightedSum, weightTotal float64
	for _, s := range scores {
		if s.Confidence <= 0 {
			continue
		}
		weightedSum += float64(s.Score * s.Confidence)
		weightTotal += float64(s.Confidence)
	}
	if weightTotal == 0 {
		return 0
	}
	return int(math.Round(weightedSum / weightTotal))
}

func computeStrengths(scores []model.SkillScore) []model.SkillInsight {
	var out []model.SkillInsight
	for _, s := range scores {
		if s.Score >= 85 && s.Confidence >= 20 {
			out = append(out, model.SkillInsight{SkillKey: s.SkillKey, Score: s.Score, Confidence: s.Confidence})
		}
	}
	return out
}

func computeWeaknesses(scores []model.SkillScore) []model.SkillInsight {
	var out []model.SkillInsight
	for _, s := range scores {
		if s.Score < 70 && s.Confidence >= 20 {
			out = append(out, model.SkillInsight{SkillKey: s.SkillKey, Score: s.Score, Confidence: s.Confidence})
		}
	}
	return out
}

func priorityForScore(normalized int) model.RecommendationPriority {
	switch {
	case normalized < 50:
		return model.RecommendationPriorityHigh
	case normalized < 70:
		return model.RecommendationPriorityMedium
	default:
		return model.RecommendationPriorityLow
	}
}

func normalizeScore(score, maxScore float64) int {
	if maxScore <= 0 {
		return 0
	}
	return int(math.Round(score / maxScore * 100))
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
	case "sql_training":
		return "SQL"
	case "company_interview":
		return "Interview"
	default:
		return humanizeSkillKey(strings.ReplaceAll(mode, "_training", ""))
	}
}

func weakestSkill(scores []model.SkillScore) *model.SkillScore {
	var weakest *model.SkillScore
	for i := range scores {
		if scores[i].Confidence < 20 || scores[i].Score >= 70 {
			continue
		}
		if weakest == nil || scores[i].Score < weakest.Score {
			weakest = &scores[i]
		}
	}
	return weakest
}
