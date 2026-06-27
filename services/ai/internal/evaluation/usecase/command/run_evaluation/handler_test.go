package run_evaluation_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	contentmocks "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content/mocks"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	interviewmocks "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview/mocks"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluatormocks "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator/mocks"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/usecase/command/run_evaluation"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/usecase/command/run_evaluation/mocks"
)

func newHandler(t *testing.T) (*run_evaluation.Handler, *mocks.Repository, *interviewmocks.Client, *contentmocks.Client, *evaluatormocks.Client) {
	repo := mocks.NewRepository(t)
	interview := interviewmocks.NewClient(t)
	content := contentmocks.NewClient(t)
	eval := evaluatormocks.NewClient(t)
	h := run_evaluation.New(run_evaluation.Deps{
		Repo: repo, Interview: interview, Content: content, Evaluator: eval, MaxRetries: 3,
	})
	return h, repo, interview, content, eval
}

func TestValidate(t *testing.T) {
	t.Parallel()
	require.ErrorIs(t, run_evaluation.Command{}.Validate(), evaluationmodel.ErrInvalidInput)
	require.NoError(t, run_evaluation.Command{AttemptID: "a"}.Validate())
}

func TestHandleAlreadyCompleted(t *testing.T) {
	t.Parallel()
	h, repo, _, _, _ := newHandler(t)
	repo.EXPECT().GetJobByAttemptID(mock.Anything, "a1").
		Return(&evaluationmodel.EvaluationJob{ID: "j1", Status: evaluationmodel.JobStatusCompleted}, nil)

	require.NoError(t, h.Handle(context.Background(), run_evaluation.Command{AttemptID: "a1"}))
}

func TestHandleSuccessFlow(t *testing.T) {
	t.Parallel()
	h, repo, interview, content, eval := newHandler(t)

	repo.EXPECT().GetJobByAttemptID(mock.Anything, "a1").Return(nil, evaluationrepo.ErrNotFound)
	interview.EXPECT().GetAttempt(mock.Anything, "a1").Return(&interviewadapter.Attempt{ID: "a1", UserID: "u1", TaskID: "t1"}, nil)
	repo.EXPECT().CreateJob(mock.Anything, mock.Anything).Return(nil)
	repo.EXPECT().UpdateJob(mock.Anything, mock.MatchedBy(func(j *evaluationmodel.EvaluationJob) bool {
		return j.Status == evaluationmodel.JobStatusRunning
	})).Return(nil)
	content.EXPECT().GetTaskBundle(mock.Anything, "t1").Return(&contentadapter.TaskBundle{
		Task: &contentadapter.Task{ID: "t1", Type: "algorithm", Title: "Two Sum"},
	}, nil)
	passed := true
	eval.EXPECT().Evaluate(mock.Anything, mock.Anything).Return(&evaluator.Output{
		Result: &evaluationmodel.EvaluationResult{Score: 90, Passed: &passed, Summary: "ok"},
		Calls:  []evaluator.CallRecord{{Provider: "fake", Model: "fake"}},
	}, nil)
	repo.EXPECT().CountModelCalls(mock.Anything, mock.Anything).Return(0, nil)
	repo.EXPECT().CreateModelCall(mock.Anything, mock.Anything).Return(nil)
	interview.EXPECT().CompleteEvaluation(mock.Anything, mock.MatchedBy(func(in interviewadapter.CompleteEvaluationInput) bool {
		return in.AttemptID == "a1" && in.Score == 90
	})).Return(nil)
	repo.EXPECT().UpdateJob(mock.Anything, mock.MatchedBy(func(j *evaluationmodel.EvaluationJob) bool {
		return j.Status == evaluationmodel.JobStatusCompleted
	})).Return(nil)

	require.NoError(t, h.Handle(context.Background(), run_evaluation.Command{AttemptID: "a1"}))
}
