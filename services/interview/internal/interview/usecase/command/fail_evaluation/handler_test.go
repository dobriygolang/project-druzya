package fail_evaluation_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/fail_evaluation"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/fail_evaluation/mocks"
)

func TestHandleMarksAttemptFailedAndReopensTask(t *testing.T) {
	t.Parallel()

	repo := mocks.NewRepository(t)
	h := fail_evaluation.New(repo)

	repo.EXPECT().WithTx(mock.Anything, mock.AnythingOfType("func(context.Context) error")).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) })
	repo.EXPECT().GetAttemptByID(mock.Anything, "a1").
		Return(&interviewmodel.Attempt{ID: "a1", SessionTaskID: "st1", Status: interviewmodel.AttemptStatusEvaluating}, nil)
	repo.EXPECT().GetSessionTaskByID(mock.Anything, "st1").
		Return(&interviewmodel.SessionTask{ID: "st1", Status: interviewmodel.SessionTaskSubmitted}, nil)
	repo.EXPECT().UpdateAttempt(mock.Anything, mock.MatchedBy(func(a *interviewmodel.Attempt) bool {
		return a.Status == interviewmodel.AttemptStatusFailed
	})).Return(nil)
	repo.EXPECT().UpdateSessionTask(mock.Anything, mock.MatchedBy(func(t *interviewmodel.SessionTask) bool {
		return t.Status == interviewmodel.SessionTaskAssigned
	})).Return(nil)

	require.NoError(t, h.Handle(context.Background(), fail_evaluation.Command{AttemptID: "a1"}))
}

func TestHandleIdempotentWhenAlreadyFailed(t *testing.T) {
	t.Parallel()

	repo := mocks.NewRepository(t)
	h := fail_evaluation.New(repo)

	repo.EXPECT().WithTx(mock.Anything, mock.AnythingOfType("func(context.Context) error")).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) })
	repo.EXPECT().GetAttemptByID(mock.Anything, "a1").
		Return(&interviewmodel.Attempt{ID: "a1", Status: interviewmodel.AttemptStatusFailed}, nil)

	require.NoError(t, h.Handle(context.Background(), fail_evaluation.Command{AttemptID: "a1"}))
}
