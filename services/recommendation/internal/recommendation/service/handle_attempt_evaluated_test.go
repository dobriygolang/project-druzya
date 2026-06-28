package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	contentadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content"
	contentmocks "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content/mocks"
	interviewmocks "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview/mocks"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	recommendationservice "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service"
	servicemocks "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service/mocks"
)

const (
	eventID   = "event-1"
	attemptID = "attempt-1"
	userID    = "550e8400-e29b-41d4-a716-446655440000"
	taskID    = "660e8400-e29b-41d4-a716-446655440001"
)

type fixture struct {
	repo      *servicemocks.Repository
	interview *interviewmocks.Client
	content   *contentmocks.Client
	svc       recommendationservice.Service
}

func setUp(t *testing.T) *fixture {
	t.Helper()
	fx := &fixture{
		repo:      servicemocks.NewRepository(t),
		interview: interviewmocks.NewClient(t),
		content:   contentmocks.NewClient(t),
	}
	fx.svc = recommendationservice.New(recommendationservice.Deps{
		Repo:      fx.repo,
		Interview: fx.interview,
		Content:   fx.content,
	})
	return fx
}

func expectWithTx(fx *fixture, ctx context.Context) {
	fx.repo.EXPECT().
		WithTx(ctx, mock.AnythingOfType("func(context.Context) error")).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		})
}

func defaultEvent() model.AttemptEvaluatedEvent {
	return model.AttemptEvaluatedEvent{
		AttemptID:  attemptID,
		UserID:     userID,
		TaskID:     taskID,
		SessionID:  "session-1",
		TaskType:   "algorithm",
		Criteria: []any{
			map[string]any{
				"key":       "correctness",
				"score":     30.0,
				"max_score": 100.0,
				"task_type": "algorithm",
			},
		},
		Score:      45,
		Passed:     false,
		OccurredAt: time.Now().UTC(),
	}
}

func defaultTask() *contentadapter.Task {
	return &contentadapter.Task{
		ID:    taskID,
		Type:  "algorithm",
		Title: "Two Sum",
	}
}

func TestHandleAttemptEvaluated_CreatesProfileAndUpdatesSkills(t *testing.T) {
	fx := setUp(t)
	ctx := context.Background()
	event := defaultEvent()

	fx.repo.EXPECT().IsEventProcessed(ctx, model.ConsumerAttemptEvaluated, eventID).Return(false, nil)
	expectWithTx(fx, ctx)
	fx.repo.EXPECT().EnsureUserProfile(ctx, userID).Return(nil)
	fx.repo.EXPECT().UpsertSkillScore(ctx, userID, "algorithm.correctness", 30, mock.AnythingOfType("time.Time")).
		Return(&model.SkillScore{SkillKey: "algorithm.correctness", Score: 30, Confidence: 10}, nil)
	fx.repo.EXPECT().ListSkillScoresByUser(ctx, userID).Return([]model.SkillScore{
		{SkillKey: "algorithm.correctness", Score: 30, Confidence: 10},
	}, nil)
	fx.repo.EXPECT().UpdateReadinessScore(ctx, userID, 30).Return(nil)
	fx.repo.EXPECT().UpsertImproveSkillRecommendation(ctx, mock.AnythingOfType("model.Recommendation")).
		Return(&model.Recommendation{Type: model.RecommendationTypeImproveSkill}, nil)
	fx.repo.EXPECT().ClaimEvent(ctx, model.ConsumerAttemptEvaluated, eventID).Return(true, nil)

	err := fx.svc.HandleAttemptEvaluated(ctx, eventID, event)
	require.NoError(t, err)
}

func TestHandleAttemptEvaluated_PassedDoesNotCreateRetryPlan(t *testing.T) {
	fx := setUp(t)
	ctx := context.Background()
	event := defaultEvent()
	event.Passed = true

	fx.repo.EXPECT().IsEventProcessed(ctx, model.ConsumerAttemptEvaluated, eventID).Return(false, nil)
	expectWithTx(fx, ctx)
	fx.repo.EXPECT().EnsureUserProfile(ctx, userID).Return(nil)
	fx.repo.EXPECT().UpsertSkillScore(ctx, userID, "algorithm.correctness", 30, mock.AnythingOfType("time.Time")).
		Return(&model.SkillScore{Score: 30, Confidence: 10}, nil)
	fx.repo.EXPECT().ListSkillScoresByUser(ctx, userID).Return([]model.SkillScore{{Score: 30, Confidence: 10}}, nil)
	fx.repo.EXPECT().UpdateReadinessScore(ctx, userID, 30).Return(nil)
	fx.repo.EXPECT().UpsertImproveSkillRecommendation(ctx, mock.AnythingOfType("model.Recommendation")).
		Return(&model.Recommendation{Type: model.RecommendationTypeImproveSkill}, nil)
	fx.repo.EXPECT().ClaimEvent(ctx, model.ConsumerAttemptEvaluated, eventID).Return(true, nil)

	err := fx.svc.HandleAttemptEvaluated(ctx, eventID, event)
	require.NoError(t, err)
}

func TestHandleAttemptEvaluated_IdempotentDuplicateEvent(t *testing.T) {
	fx := setUp(t)
	ctx := context.Background()
	event := defaultEvent()

	fx.repo.EXPECT().IsEventProcessed(ctx, model.ConsumerAttemptEvaluated, eventID).Return(true, nil)

	err := fx.svc.HandleAttemptEvaluated(ctx, eventID, event)
	require.NoError(t, err)
}

func TestHandleSessionCompleted_HighReadinessCreatesMockInterview(t *testing.T) {
	fx := setUp(t)
	ctx := context.Background()
	event := model.SessionCompletedEvent{
		SessionID: "session-1",
		UserID:    userID,
		Mode:      "algorithms_training",
	}

	fx.repo.EXPECT().IsEventProcessed(ctx, model.ConsumerSessionCompleted, eventID).Return(false, nil)
	expectWithTx(fx, ctx)
	fx.repo.EXPECT().EnsureUserProfile(ctx, userID).Return(nil)
	fx.repo.EXPECT().GetUserProfile(ctx, userID).Return(&model.UserSkillProfile{ReadinessScore: 85}, nil)
	fx.repo.EXPECT().ListSkillScoresByUser(ctx, userID).Return([]model.SkillScore{
		{SkillKey: "algorithm.correctness", Score: 60, Confidence: 30},
	}, nil)
	fx.repo.EXPECT().InsertTakeMockRecommendation(ctx, mock.MatchedBy(func(rec model.Recommendation) bool {
		return rec.Type == model.RecommendationTypeTakeMockInterview && rec.Metadata["suggested_mode"] == "algorithms_training"
	})).Return(&model.Recommendation{Type: model.RecommendationTypeTakeMockInterview}, nil)
	fx.repo.EXPECT().InsertSpecialRecommendation(ctx, mock.AnythingOfType("model.Recommendation")).
		Return(&model.Recommendation{Type: model.RecommendationTypePracticeSection}, nil)
	fx.repo.EXPECT().ClaimEvent(ctx, model.ConsumerSessionCompleted, eventID).Return(true, nil)

	err := fx.svc.HandleSessionCompleted(ctx, eventID, event)
	require.NoError(t, err)
}

func TestHandleRetryItemCreated_ReconcilesPlanItem(t *testing.T) {
	fx := setUp(t)
	ctx := context.Background()
	event := model.RetryItemCreatedEvent{
		RetryItemID: "retry-1",
		UserID:      userID,
		TaskID:      taskID,
		AttemptID:   attemptID,
	}

	fx.repo.EXPECT().IsEventProcessed(ctx, model.ConsumerRetryItemCreated, eventID).Return(false, nil)
	fx.content.EXPECT().GetTask(ctx, taskID).Return(defaultTask(), nil)
	expectWithTx(fx, ctx)
	fx.repo.EXPECT().EnsureUserProfile(ctx, userID).Return(nil)
	fx.repo.EXPECT().NextLearningPlanPosition(ctx, userID).Return(1, nil)
	fx.repo.EXPECT().CreateRetryTaskPlanItem(ctx, mock.MatchedBy(func(item model.LearningPlanItem) bool {
		return item.Metadata["retry_item_id"] == "retry-1"
	})).Return(&model.LearningPlanItem{Type: model.LearningPlanItemTypeRetryTask}, nil)
	fx.repo.EXPECT().ClaimEvent(ctx, model.ConsumerRetryItemCreated, eventID).Return(true, nil)

	err := fx.svc.HandleRetryItemCreated(ctx, eventID, event)
	require.NoError(t, err)
}

func TestHandleTaskSkipped_EnsureProfile(t *testing.T) {
	fx := setUp(t)
	ctx := context.Background()
	event := model.TaskSkippedEvent{
		SessionTaskID: "st-1",
		SessionID:     "session-1",
		UserID:        userID,
		TaskID:        taskID,
		Mode:          "algorithms_training",
	}

	fx.repo.EXPECT().IsEventProcessed(ctx, model.ConsumerTaskSkipped, eventID).Return(false, nil)
	expectWithTx(fx, ctx)
	fx.repo.EXPECT().EnsureUserProfile(ctx, userID).Return(nil)
	fx.repo.EXPECT().ClaimEvent(ctx, model.ConsumerTaskSkipped, eventID).Return(true, nil)

	err := fx.svc.HandleTaskSkipped(ctx, eventID, event)
	require.NoError(t, err)
}
