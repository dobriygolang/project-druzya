package service_test

import (
	"context"
	"encoding/json"
	"errors"
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
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	servicemocks "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service/mocks"
)

const (
	attemptID = "attempt-1"
	userID    = "user-1"
	taskID    = "task-1"
)

type fixture struct {
	repo      *servicemocks.Repository
	interview *interviewmocks.Client
	content   *contentmocks.Client
	evaluator *evaluatormocks.Client
	svc       evaluationservice.Service
}

func setUp(t *testing.T) *fixture {
	t.Helper()

	fx := &fixture{
		repo:      servicemocks.NewRepository(t),
		interview: interviewmocks.NewClient(t),
		content:   contentmocks.NewClient(t),
		evaluator: evaluatormocks.NewClient(t),
	}
	fx.svc = evaluationservice.New(evaluationservice.Deps{
		Repo:       fx.repo,
		Interview:  fx.interview,
		Content:    fx.content,
		Evaluator:  fx.evaluator,
		MaxRetries: 3,
	})
	return fx
}

func defaultAttempt() *interviewadapter.Attempt {
	answer := "candidate answer"
	return &interviewadapter.Attempt{
		ID:          attemptID,
		UserID:      userID,
		TaskID:      taskID,
		AnswerText:  &answer,
		Attachments: json.RawMessage(`[]`),
		Status:      "evaluating",
	}
}

func defaultTaskBundle() *contentadapter.TaskBundle {
	return &contentadapter.TaskBundle{
		Task: &contentadapter.Task{
			ID:          taskID,
			Type:        "algorithm",
			Title:       "Two Sum",
			Description: "Find pair with target sum",
		},
		Rubric: &contentadapter.Rubric{Title: "Algorithm rubric", Version: 1},
		Criteria: []contentadapter.RubricCriterion{
			{Key: "correctness", Title: "Correctness", Weight: 50, MaxScore: 100},
		},
	}
}

func validEvalOutput() *evaluator.Output {
	passed := true
	return &evaluator.Output{
		Result: &evaluationmodel.EvaluationResult{
			Score:        85,
			Passed:       &passed,
			Summary:      "Good",
			Strengths:    []string{"clear"},
			Improvements: []string{"tests"},
		},
		Calls: []evaluator.CallRecord{{
			Provider:     "fake",
			Model:        "fake",
			RequestJSON:  []byte(`{}`),
			ResponseJSON: []byte(`{}`),
			LatencyMS:    1,
		}},
	}
}

func expectRunEvaluationJobStart(fx *fixture) {
	fx.repo.EXPECT().
		GetJobByAttemptID(mock.Anything, attemptID).
		Return(nil, evaluationrepo.ErrNotFound).
		Once()

	fx.repo.EXPECT().
		CreateJob(mock.Anything, mock.Anything).
		Return(nil).
		Once()

	fx.repo.EXPECT().
		UpdateJob(mock.Anything, mock.MatchedBy(func(j *evaluationmodel.EvaluationJob) bool {
			return j.Status == evaluationmodel.JobStatusRunning
		})).
		Return(nil).
		Once()
}

func expectHandleAttemptSubmittedJobStart(fx *fixture) {
	job := &evaluationmodel.EvaluationJob{
		ID:        "job-1",
		AttemptID: attemptID,
		UserID:    userID,
		TaskID:    taskID,
		Status:    evaluationmodel.JobStatusPending,
		Retryable: true,
	}

	fx.repo.EXPECT().
		GetJobByAttemptID(mock.Anything, attemptID).
		Return(nil, evaluationrepo.ErrNotFound).
		Once()

	fx.repo.EXPECT().
		CreateJob(mock.Anything, mock.Anything).
		Return(nil).
		Once()

	fx.repo.EXPECT().
		GetJobByAttemptID(mock.Anything, attemptID).
		Return(job, nil).
		Once()

	fx.repo.EXPECT().
		UpdateJob(mock.Anything, mock.MatchedBy(func(j *evaluationmodel.EvaluationJob) bool {
			return j.Status == evaluationmodel.JobStatusRunning
		})).
		Return(nil).
		Once()
}

func expectEvaluationPipeline(fx *fixture, out *evaluator.Output, evalErr error) {
	fx.interview.EXPECT().
		GetAttempt(mock.Anything, attemptID).
		Return(defaultAttempt(), nil).
		Once()

	fx.content.EXPECT().
		GetTaskBundle(mock.Anything, taskID).
		Return(defaultTaskBundle(), nil).
		Once()

	if evalErr != nil {
		fx.evaluator.EXPECT().
			Evaluate(mock.Anything, mock.Anything).
			Return(nil, evalErr).
			Once()
		return
	}

	fx.evaluator.EXPECT().
		Evaluate(mock.Anything, mock.Anything).
		Return(out, nil).
		Once()

	fx.repo.EXPECT().
		CountModelCalls(mock.Anything, mock.Anything).
		Return(0, nil).
		Once()

	for range out.Calls {
		fx.repo.EXPECT().
			CreateModelCall(mock.Anything, mock.Anything).
			Return(nil).
			Once()
	}
}

func TestHandleAttemptSubmitted_createsJob(t *testing.T) {
	t.Parallel()

	fx := setUp(t)
	expectHandleAttemptSubmittedJobStart(fx)
	expectEvaluationPipeline(fx, validEvalOutput(), nil)

	fx.interview.EXPECT().
		CompleteEvaluation(mock.Anything, mock.MatchedBy(func(input interviewadapter.CompleteEvaluationInput) bool {
			return input.AttemptID == attemptID && input.Score == 85
		})).
		Return(nil).
		Once()

	fx.repo.EXPECT().
		UpdateJob(mock.Anything, mock.MatchedBy(func(job *evaluationmodel.EvaluationJob) bool {
			return job.Status == evaluationmodel.JobStatusCompleted
		})).
		Return(nil).
		Once()

	err := fx.svc.HandleAttemptSubmitted(context.Background(), evaluationmodel.AttemptSubmittedEvent{
		AttemptID: attemptID,
		UserID:    userID,
		TaskID:    taskID,
	})
	require.NoError(t, err)
}

func TestHandleAttemptSubmitted_idempotent(t *testing.T) {
	t.Parallel()

	fx := setUp(t)

	completedJob := &evaluationmodel.EvaluationJob{
		ID:        "job-1",
		AttemptID: attemptID,
		Status:    evaluationmodel.JobStatusCompleted,
	}

	fx.repo.EXPECT().
		GetJobByAttemptID(mock.Anything, attemptID).
		Return(completedJob, nil).
		Times(2)

	event := evaluationmodel.AttemptSubmittedEvent{
		AttemptID: attemptID,
		UserID:    userID,
		TaskID:    taskID,
	}
	require.NoError(t, fx.svc.HandleAttemptSubmitted(context.Background(), event))
	require.NoError(t, fx.svc.HandleAttemptSubmitted(context.Background(), event))
}

func TestRunEvaluation_evaluatorError_retries(t *testing.T) {
	t.Parallel()

	fx := setUp(t)
	expectRunEvaluationJobStart(fx)
	expectEvaluationPipeline(fx, nil, errors.New("provider down"))

	fx.repo.EXPECT().
		UpdateJob(mock.Anything, mock.MatchedBy(func(job *evaluationmodel.EvaluationJob) bool {
			return job.Status == evaluationmodel.JobStatusPending && job.RetryCount == 1 && job.Retryable
		})).
		Return(nil).
		Once()

	err := fx.svc.RunEvaluation(context.Background(), attemptID)
	require.Error(t, err)
}

func TestRunEvaluation_callError_retries(t *testing.T) {
	t.Parallel()

	fx := setUp(t)
	expectRunEvaluationJobStart(fx)

	errMsg := "parse failed"
	out := validEvalOutput()
	out.Calls[0].Error = &errMsg

	expectEvaluationPipeline(fx, out, nil)

	fx.repo.EXPECT().
		UpdateJob(mock.Anything, mock.MatchedBy(func(job *evaluationmodel.EvaluationJob) bool {
			return job.Status == evaluationmodel.JobStatusPending && job.RetryCount == 1
		})).
		Return(nil).
		Once()

	err := fx.svc.RunEvaluation(context.Background(), attemptID)
	require.Error(t, err)
}

func TestRunEvaluation_successFlow(t *testing.T) {
	t.Parallel()

	fx := setUp(t)
	expectRunEvaluationJobStart(fx)
	expectEvaluationPipeline(fx, validEvalOutput(), nil)

	fx.interview.EXPECT().
		CompleteEvaluation(mock.Anything, mock.MatchedBy(func(input interviewadapter.CompleteEvaluationInput) bool {
			return input.AttemptID == attemptID && input.Score == 85 && input.Passed != nil && *input.Passed
		})).
		Return(nil).
		Once()

	fx.repo.EXPECT().
		UpdateJob(mock.Anything, mock.MatchedBy(func(job *evaluationmodel.EvaluationJob) bool {
			return job.Status == evaluationmodel.JobStatusCompleted && job.CompletedAt != nil
		})).
		Return(nil).
		Once()

	require.NoError(t, fx.svc.RunEvaluation(context.Background(), attemptID))
}

func TestRunEvaluation_alreadyCompleted(t *testing.T) {
	t.Parallel()

	fx := setUp(t)

	fx.repo.EXPECT().
		GetJobByAttemptID(mock.Anything, attemptID).
		Return(&evaluationmodel.EvaluationJob{
			ID:        "job-1",
			AttemptID: attemptID,
			Status:    evaluationmodel.JobStatusCompleted,
		}, nil).
		Once()

	require.NoError(t, fx.svc.RunEvaluation(context.Background(), attemptID))
}

func TestHandleAttemptSubmitted_missingAttemptID(t *testing.T) {
	t.Parallel()

	fx := setUp(t)
	err := fx.svc.HandleAttemptSubmitted(context.Background(), evaluationmodel.AttemptSubmittedEvent{})
	require.ErrorIs(t, err, evaluationservice.ErrInvalidInput)
}
