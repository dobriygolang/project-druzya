package run_evaluation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	billingadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing"
	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
)

const defaultMaxRetries = 3

// Repository is the job/model-call persistence port (consumer-side interface).
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Repository --output=./mocks --outpkg=mocks --filename=repository.go
type Repository interface {
	GetJobByAttemptID(ctx context.Context, attemptID string) (*evaluationmodel.EvaluationJob, error)
	CreateJob(ctx context.Context, job *evaluationmodel.EvaluationJob) error
	UpdateJob(ctx context.Context, job *evaluationmodel.EvaluationJob) error
	CountModelCalls(ctx context.Context, jobID string) (int, error)
	CreateModelCall(ctx context.Context, call *evaluationmodel.ModelCall) error
}

// InterviewClient reads the attempt and reports the evaluation result.
type InterviewClient interface {
	GetAttempt(ctx context.Context, attemptID string) (*interviewadapter.Attempt, error)
	CompleteEvaluation(ctx context.Context, input interviewadapter.CompleteEvaluationInput) error
}

// ContentClient provides the task bundle (rubric + reference solutions).
type ContentClient interface {
	GetTaskBundle(ctx context.Context, taskID string) (*contentadapter.TaskBundle, error)
}

// BillingClient consumes evaluation quota (optional; may be nil).
type BillingClient interface {
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error
}

// Deps wires the run-evaluation handler.
type Deps struct {
	Repo       Repository
	Interview  InterviewClient
	Content    ContentClient
	Billing    BillingClient
	Evaluator  evaluator.Client
	MaxRetries int
}

// Handler evaluates one attempt.
type Handler struct {
	repo       Repository
	interview  InterviewClient
	content    ContentClient
	billing    BillingClient
	evaluator  evaluator.Client
	maxRetries int
}

// New constructs the run-evaluation handler.
func New(deps Deps) *Handler {
	maxRetries := deps.MaxRetries
	if maxRetries <= 0 {
		maxRetries = defaultMaxRetries
	}
	return &Handler{
		repo:       deps.Repo,
		interview:  deps.Interview,
		content:    deps.Content,
		billing:    deps.Billing,
		evaluator:  deps.Evaluator,
		maxRetries: maxRetries,
	}
}

// Handle runs (or re-runs) evaluation for an attempt. Idempotent: completed jobs
// short-circuit before any external call.
func (h *Handler) Handle(ctx context.Context, cmd Command) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	attemptID := cmd.AttemptID

	job, err := h.repo.GetJobByAttemptID(ctx, attemptID)
	switch {
	case err == nil:
		if job.Status == evaluationmodel.JobStatusCompleted {
			return nil
		}
	case isNotFound(err):
		job = nil
	default:
		return err
	}

	// Load the attempt: needed for the answer and for user_id/task_id (NOT NULL
	// UUID) when the job has to be created.
	attempt, err := h.interview.GetAttempt(ctx, attemptID)
	if err != nil {
		return err
	}

	if job == nil {
		job, err = h.createJobForAttempt(ctx, attemptID, attempt.UserID, attempt.TaskID)
		if err != nil {
			return err
		}
		if job.Status == evaluationmodel.JobStatusCompleted {
			return nil
		}
	}
	if job.TaskID == "" {
		job.TaskID = attempt.TaskID
	}
	if job.UserID == "" {
		job.UserID = attempt.UserID
	}

	// Gate by quota only on the first attempt so retries do not double-charge.
	if job.RetryCount == 0 {
		if err := h.consumeBillingUsage(ctx, attempt.UserID); err != nil {
			return err
		}
	}

	now := time.Now().UTC()
	job.Status = evaluationmodel.JobStatusRunning
	job.StartedAt = &now
	job.UpdatedAt = now
	job.Error = nil
	if err := h.repo.UpdateJob(ctx, job); err != nil {
		return err
	}

	runErr := h.executeEvaluation(ctx, job, attempt)
	if runErr == nil {
		completed := time.Now().UTC()
		job.Status = evaluationmodel.JobStatusCompleted
		job.CompletedAt = &completed
		job.UpdatedAt = completed
		job.Error = nil
		return h.repo.UpdateJob(ctx, job)
	}
	return h.markJobFailed(ctx, job, runErr)
}

// EnsureJob creates the pending job if absent and reports whether it is already
// completed. Used by the outbox handler before invoking Handle.
func (h *Handler) EnsureJob(ctx context.Context, attemptID, userID, taskID string) (completed bool, err error) {
	existing, err := h.repo.GetJobByAttemptID(ctx, attemptID)
	if err == nil {
		return existing.Status == evaluationmodel.JobStatusCompleted, nil
	}
	if !isNotFound(err) {
		return false, err
	}
	job, err := h.createJobForAttempt(ctx, attemptID, userID, taskID)
	if err != nil {
		return false, err
	}
	return job.Status == evaluationmodel.JobStatusCompleted, nil
}

func (h *Handler) consumeBillingUsage(ctx context.Context, userID string) error {
	if h.billing == nil || userID == "" {
		return nil
	}
	if err := h.billing.CheckAndConsumeUsage(ctx, userID, billingadapter.EntitlementAIEvaluationsPerDay, 1); err != nil {
		if errors.Is(err, billingadapter.ErrQuotaExceeded) {
			return evaluationmodel.ErrQuotaExceeded
		}
		return err
	}
	return nil
}

func (h *Handler) executeEvaluation(ctx context.Context, job *evaluationmodel.EvaluationJob, attempt *interviewadapter.Attempt) error {
	bundle, err := h.content.GetTaskBundle(ctx, attempt.TaskID)
	if err != nil {
		return err
	}

	answerText := derefString(attempt.AnswerText)
	code := derefString(attempt.Code)
	language := derefString(attempt.Language)

	taskType, title, description := "", "", ""
	if bundle.Task != nil {
		taskType = bundle.Task.Type
		title = bundle.Task.Title
		description = bundle.Task.Description
	}

	evalOut, err := h.evaluator.Evaluate(ctx, evaluator.InputFromBundle(
		taskType, title, description,
		bundle.Criteria, bundle.Solutions,
		answerText, code, language,
	))
	if err != nil {
		return err
	}

	callNo, err := h.repo.CountModelCalls(ctx, job.ID)
	if err != nil {
		return err
	}
	for _, call := range evalOut.Calls {
		callNo++
		if err := h.repo.CreateModelCall(ctx, &evaluationmodel.ModelCall{
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
			CostUSD:          costToDecimal(call.CostUSD),
			LatencyMS:        &call.LatencyMS,
			Error:            call.Error,
			CallNo:           callNo,
			CreatedAt:        time.Now().UTC(),
		}); err != nil {
			return err
		}
		if call.Error != nil {
			return fmt.Errorf("%w: %s", evaluationmodel.ErrEvaluation, *call.Error)
		}
	}

	result := evalOut.Result
	if result == nil {
		return fmt.Errorf("%w: empty evaluator result", evaluationmodel.ErrEvaluation)
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
	return h.interview.CompleteEvaluation(ctx, interviewadapter.CompleteEvaluationInput{
		AttemptID: job.AttemptID,
		Score:     result.Score,
		Passed:    &passed,
		Summary:   &summary,
		Feedback:  feedback,
	})
}

func (h *Handler) createJobForAttempt(ctx context.Context, attemptID, userID, taskID string) (*evaluationmodel.EvaluationJob, error) {
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
	if err := h.repo.CreateJob(ctx, job); err != nil {
		if isConflict(err) {
			return h.repo.GetJobByAttemptID(ctx, attemptID)
		}
		return nil, err
	}
	return job, nil
}

func (h *Handler) markJobFailed(ctx context.Context, job *evaluationmodel.EvaluationJob, runErr error) error {
	now := time.Now().UTC()
	msg := runErr.Error()
	job.RetryCount++
	job.Error = &msg
	job.UpdatedAt = now
	job.Retryable = job.RetryCount < h.maxRetries && !errors.Is(runErr, evaluationmodel.ErrQuotaExceeded)
	if job.Retryable {
		retryAt := now.Add(time.Minute * time.Duration(job.RetryCount))
		job.NextRetryAt = &retryAt
		job.Status = evaluationmodel.JobStatusPending
	} else {
		job.Status = evaluationmodel.JobStatusFailed
		completed := now
		job.CompletedAt = &completed
	}
	if err := h.repo.UpdateJob(ctx, job); err != nil {
		return err
	}
	return runErr
}

func isNotFound(err error) bool { return errors.Is(err, evaluationrepo.ErrNotFound) }
func isConflict(err error) bool { return errors.Is(err, evaluationrepo.ErrConflict) }

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func costToDecimal(usd *float64) *decimal.Decimal {
	if usd == nil {
		return nil
	}
	d := decimal.NewFromFloat(*usd)
	return &d
}
