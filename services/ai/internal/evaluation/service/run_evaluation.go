package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	billingadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

func (s *evaluationService) RunEvaluation(ctx context.Context, attemptID string) error {
	if attemptID == "" {
		return fmt.Errorf("attempt_id required: %w", ErrInvalidInput)
	}

	job, err := s.ensureJobForAttempt(ctx, attemptID, "", "")
	if err != nil {
		return err
	}
	if job.Status == evaluationmodel.JobStatusCompleted {
		return nil
	}

	attempt, err := s.interview.GetAttempt(ctx, attemptID)
	if err != nil {
		return err
	}
	if job.TaskID == "" {
		job.TaskID = attempt.TaskID
	}
	if job.UserID == "" {
		job.UserID = attempt.UserID
	}

	if err := s.consumeBillingUsage(ctx, attempt.UserID); err != nil {
		return err
	}

	now := time.Now().UTC()
	job.Status = evaluationmodel.JobStatusRunning
	job.StartedAt = &now
	job.UpdatedAt = now
	job.Error = nil
	if err := s.repo.UpdateJob(ctx, job); err != nil {
		return err
	}

	runErr := s.executeEvaluation(ctx, job, attempt)
	if runErr == nil {
		completed := time.Now().UTC()
		job.Status = evaluationmodel.JobStatusCompleted
		job.CompletedAt = &completed
		job.UpdatedAt = completed
		job.Error = nil
		if err := s.repo.UpdateJob(ctx, job); err != nil {
			return err
		}
		return nil
	}

	return s.markJobFailed(ctx, job, runErr)
}

func (s *evaluationService) consumeBillingUsage(ctx context.Context, userID string) error {
	if s.billing == nil || userID == "" {
		return nil
	}
	if err := s.billing.CheckAndConsumeUsage(ctx, userID, billingadapter.EntitlementAIEvaluationsPerDay, 1); err != nil {
		if errors.Is(err, billingadapter.ErrQuotaExceeded) {
			return ErrQuotaExceeded
		}
		return err
	}
	return nil
}

func (s *evaluationService) executeEvaluation(
	ctx context.Context,
	job *evaluationmodel.EvaluationJob,
	attempt *interviewadapter.Attempt,
) error {
	bundle, err := s.content.GetTaskBundle(ctx, attempt.TaskID)
	if err != nil {
		return err
	}

	answerText := ""
	if attempt.AnswerText != nil {
		answerText = *attempt.AnswerText
	}
	code := ""
	if attempt.Code != nil {
		code = *attempt.Code
	}
	language := ""
	if attempt.Language != nil {
		language = *attempt.Language
	}

	taskType := ""
	title := ""
	description := ""
	if bundle.Task != nil {
		taskType = bundle.Task.Type
		title = bundle.Task.Title
		description = bundle.Task.Description
	}

	evalOut, err := s.evaluator.Evaluate(ctx, evaluator.InputFromBundle(
		taskType, title, description,
		bundle.Criteria, bundle.Solutions,
		answerText, code, language,
	))
	if err != nil {
		return err
	}

	callNo, err := s.repo.CountModelCalls(ctx, job.ID)
	if err != nil {
		return err
	}

	for _, call := range evalOut.Calls {
		callNo++
		if err := s.repo.CreateModelCall(ctx, &evaluationmodel.ModelCall{
			ID:               uuid.NewString(),
			EvaluationJobID:  job.ID,
			Provider:         call.Provider,
			Model:            call.Model,
			RequestJSON:      call.RequestJSON,
			ResponseJSON:     call.ResponseJSON,
			ParsedResult:     call.ParsedResult,
			PromptTokens:     call.PromptTokens,
			CompletionTokens: call.CompletionTokens,
			TotalTokens:      call.TotalTokens,
			LatencyMS:        &call.LatencyMS,
			Error:            call.Error,
			CallNo:           callNo,
			CreatedAt:        time.Now().UTC(),
		}); err != nil {
			return err
		}
		if call.Error != nil {
			return fmt.Errorf("%w: %s", ErrEvaluation, *call.Error)
		}
	}

	result := evalOut.Result
	if result == nil {
		return fmt.Errorf("%w: empty evaluator result", ErrEvaluation)
	}

	summary := result.Summary
	feedback := result.Feedback
	if feedback == nil {
		feedback = map[string]any{}
	}
	if len(result.Strengths) > 0 {
		feedback["strengths"] = result.Strengths
	}
	if len(result.Improvements) > 0 {
		feedback["improvements"] = result.Improvements
	}
	if len(evalOut.Criteria) > 0 {
		criteria := make([]map[string]any, 0, len(evalOut.Criteria))
		for _, c := range evalOut.Criteria {
			criteria = append(criteria, map[string]any{
				"key":       c.Key,
				"score":     c.Score,
				"max_score": c.MaxScore,
				"task_type": taskType,
			})
		}
		feedback["criteria"] = criteria
	}

	passed := result.Passed != nil && *result.Passed
	return s.interview.CompleteEvaluation(ctx, interviewadapter.CompleteEvaluationInput{
		AttemptID: job.AttemptID,
		Score:     result.Score,
		Passed:    &passed,
		Summary:   &summary,
		Feedback:  feedback,
	})
}

func (s *evaluationService) ensureJobForAttempt(ctx context.Context, attemptID, userID, taskID string) (*evaluationmodel.EvaluationJob, error) {
	existing, err := s.repo.GetJobByAttemptID(ctx, attemptID)
	if err == nil {
		return existing, nil
	}
	if !isNotFound(err) {
		return nil, err
	}

	now := time.Now().UTC()
	job := &evaluationmodel.EvaluationJob{
		ID:        uuid.NewString(),
		AttemptID: attemptID,
		UserID:    userID,
		TaskID:    taskID,
		Status:    evaluationmodel.JobStatusPending,
		Retryable: true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.CreateJob(ctx, job); err != nil {
		if isConflict(err) {
			return s.repo.GetJobByAttemptID(ctx, attemptID)
		}
		return nil, err
	}
	return job, nil
}

func (s *evaluationService) markJobFailed(ctx context.Context, job *evaluationmodel.EvaluationJob, runErr error) error {
	now := time.Now().UTC()
	msg := runErr.Error()
	job.RetryCount++
	job.Error = &msg
	job.UpdatedAt = now
	job.Retryable = job.RetryCount < s.maxRetries && !errors.Is(runErr, ErrQuotaExceeded)
	if job.Retryable {
		retryAt := now.Add(time.Minute * time.Duration(job.RetryCount))
		job.NextRetryAt = &retryAt
		job.Status = evaluationmodel.JobStatusPending
	} else {
		job.Status = evaluationmodel.JobStatusFailed
		completed := now
		job.CompletedAt = &completed
	}
	if err := s.repo.UpdateJob(ctx, job); err != nil {
		return err
	}
	return runErr
}

func (s *evaluationService) GetEvaluationJob(ctx context.Context, id string) (*evaluationmodel.EvaluationJob, error) {
	if id == "" {
		return nil, fmt.Errorf("id required: %w", ErrInvalidInput)
	}
	return s.repo.GetJobByID(ctx, id)
}

func (s *evaluationService) GetEvaluationJobByAttemptID(ctx context.Context, attemptID string) (*evaluationmodel.EvaluationJob, error) {
	if attemptID == "" {
		return nil, fmt.Errorf("attempt_id required: %w", ErrInvalidInput)
	}
	return s.repo.GetJobByAttemptID(ctx, attemptID)
}

func (s *evaluationService) ListEvaluationJobs(ctx context.Context, status *evaluationmodel.JobStatus, limit int) ([]evaluationmodel.EvaluationJob, error) {
	return s.repo.ListJobs(ctx, status, limit)
}
