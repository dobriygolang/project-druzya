package complete_evaluation_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/complete_evaluation"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/complete_evaluation/mocks"
)

func boolPtr(b bool) *bool { return &b }

func TestValidateRequiresAttemptID(t *testing.T) {
	t.Parallel()
	require.ErrorIs(t, complete_evaluation.Command{}.Validate(), interviewmodel.ErrInvalidInput)
	require.NoError(t, complete_evaluation.Command{AttemptID: "a"}.Validate())
}

func TestHandleIdempotentWhenAlreadyEvaluated(t *testing.T) {
	t.Parallel()
	repo := mocks.NewRepository(t)
	scorer := mocks.NewSessionScorer(t)
	h := complete_evaluation.New(repo, scorer)

	repo.EXPECT().WithTx(mock.Anything, mock.AnythingOfType("func(context.Context) error")).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) })
	repo.EXPECT().GetAttemptByID(mock.Anything, "a1").
		Return(&interviewmodel.Attempt{ID: "a1", Status: interviewmodel.AttemptStatusEvaluated}, nil)
	repo.EXPECT().GetEvaluationSummaryByAttemptID(mock.Anything, "a1").
		Return(&interviewmodel.EvaluationSummary{ID: "sum1", AttemptID: "a1"}, nil)

	got, err := h.Handle(context.Background(), complete_evaluation.Command{AttemptID: "a1", Score: 90})
	require.NoError(t, err)
	require.Equal(t, "sum1", got.ID)
}

func TestHandleFailedCreatesRetryAndOutbox(t *testing.T) {
	t.Parallel()
	repo := mocks.NewRepository(t)
	scorer := mocks.NewSessionScorer(t)
	h := complete_evaluation.New(repo, scorer)

	repo.EXPECT().WithTx(mock.Anything, mock.AnythingOfType("func(context.Context) error")).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) })
	repo.EXPECT().GetAttemptByID(mock.Anything, "a1").
		Return(&interviewmodel.Attempt{ID: "a1", SessionTaskID: "st1", TaskID: "t1", UserID: "u1", Status: interviewmodel.AttemptStatusEvaluating}, nil)
	repo.EXPECT().GetSessionTaskByID(mock.Anything, "st1").
		Return(&interviewmodel.SessionTask{ID: "st1", SessionID: "s1"}, nil)
	repo.EXPECT().GetSessionByID(mock.Anything, "s1").
		Return(&interviewmodel.Session{ID: "s1", UserID: "u1", PassingScore: 85}, nil)
	repo.EXPECT().CreateEvaluationSummary(mock.Anything, mock.Anything).Return(nil)
	repo.EXPECT().UpdateAttempt(mock.Anything, mock.MatchedBy(func(a *interviewmodel.Attempt) bool {
		return a.Status == interviewmodel.AttemptStatusEvaluated
	})).Return(nil)
	repo.EXPECT().UpdateSessionTask(mock.Anything, mock.Anything).Return(nil)
	repo.EXPECT().CreateRetryItemIfAbsent(mock.Anything, mock.Anything).Return(true, nil)
	scorer.EXPECT().RecalculateScores(mock.Anything, mock.Anything).Return(false, nil)
	// attempt_evaluated + retry_item_created outbox events.
	repo.EXPECT().InsertOutbox(mock.Anything, "interview.attempt_evaluated", mock.Anything).Return(nil)
	repo.EXPECT().InsertOutbox(mock.Anything, "interview.retry_item_created", mock.Anything).Return(nil)

	got, err := h.Handle(context.Background(), complete_evaluation.Command{AttemptID: "a1", Score: 40, Passed: boolPtr(false)})
	require.NoError(t, err)
	require.False(t, got.Passed)
}
