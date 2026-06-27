package complete_evaluation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

// Repository is the persistence port this command needs (consumer-side interface).
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Repository --output=./mocks --outpkg=mocks --filename=repository.go
type Repository interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	GetAttemptByID(ctx context.Context, id string) (*interviewmodel.Attempt, error)
	GetEvaluationSummaryByAttemptID(ctx context.Context, attemptID string) (*interviewmodel.EvaluationSummary, error)
	GetSessionTaskByID(ctx context.Context, id string) (*interviewmodel.SessionTask, error)
	GetSessionByID(ctx context.Context, id string) (*interviewmodel.Session, error)
	CreateEvaluationSummary(ctx context.Context, summary *interviewmodel.EvaluationSummary) error
	UpdateAttempt(ctx context.Context, attempt *interviewmodel.Attempt) error
	UpdateSessionTask(ctx context.Context, task *interviewmodel.SessionTask) error
	CreateRetryItemIfAbsent(ctx context.Context, item *interviewmodel.RetryItem) (bool, error)
	InsertOutbox(ctx context.Context, eventName string, payload map[string]any) error
}

// SessionScorer recomputes section/session scores and reports whether the
// session is now complete. Provided by the domain service so the scoring rules
// stay shared with SkipTask.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=SessionScorer --output=./mocks --outpkg=mocks --filename=session_scorer.go
type SessionScorer interface {
	RecalculateScores(ctx context.Context, session *interviewmodel.Session) (bool, error)
}

// Handler records an attempt evaluation.
type Handler struct {
	repo   Repository
	scorer SessionScorer
}

// New constructs the complete-evaluation handler.
func New(repo Repository, scorer SessionScorer) *Handler {
	return &Handler{repo: repo, scorer: scorer}
}

// Handle executes the command. It is idempotent: an already-evaluated attempt
// returns the existing summary without side effects.
func (h *Handler) Handle(ctx context.Context, cmd Command) (*interviewmodel.EvaluationSummary, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}

	var summary *interviewmodel.EvaluationSummary
	err := h.repo.WithTx(ctx, func(txCtx context.Context) error {
		attempt, err := h.repo.GetAttemptByID(txCtx, cmd.AttemptID)
		if err != nil {
			return err
		}

		if attempt.Status == interviewmodel.AttemptStatusEvaluated {
			existing, err := h.repo.GetEvaluationSummaryByAttemptID(txCtx, attempt.ID)
			if err != nil {
				return err
			}
			summary = existing
			return nil
		}
		if attempt.Status != interviewmodel.AttemptStatusEvaluating {
			return fmt.Errorf("attempt not evaluating: %w", interviewrepo.ErrConflict)
		}

		sessionTask, err := h.repo.GetSessionTaskByID(txCtx, attempt.SessionTaskID)
		if err != nil {
			return err
		}
		session, err := h.repo.GetSessionByID(txCtx, sessionTask.SessionID)
		if err != nil {
			return err
		}

		score := decimal.NewFromFloat(cmd.Score)
		passed := cmd.Passed != nil && *cmd.Passed
		if cmd.Passed == nil {
			passed = score.GreaterThanOrEqual(decimal.NewFromInt(int64(session.PassingScore)))
		}

		now := time.Now().UTC()
		feedbackBytes, err := json.Marshal(cmd.Feedback)
		if err != nil || len(cmd.Feedback) == 0 {
			feedbackBytes = json.RawMessage("{}")
		}

		created := &interviewmodel.EvaluationSummary{
			ID:        uuid.NewString(),
			AttemptID: attempt.ID,
			Score:     score,
			Passed:    passed,
			Summary:   cmd.Summary,
			Feedback:  feedbackBytes,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := h.repo.CreateEvaluationSummary(txCtx, created); err != nil {
			return err
		}

		attempt.Status = interviewmodel.AttemptStatusEvaluated
		attempt.UpdatedAt = now
		if err := h.repo.UpdateAttempt(txCtx, attempt); err != nil {
			return err
		}

		sessionTask.Status = interviewmodel.SessionTaskEvaluated
		sessionTask.UpdatedAt = now
		if err := h.repo.UpdateSessionTask(txCtx, sessionTask); err != nil {
			return err
		}

		retryItemCreated := false
		retryItemID := ""
		if !passed {
			reason := "score below passing threshold"
			retryItem := &interviewmodel.RetryItem{
				ID:              uuid.NewString(),
				UserID:          attempt.UserID,
				TaskID:          attempt.TaskID,
				SourceAttemptID: attempt.ID,
				Reason:          &reason,
				Status:          interviewmodel.RetryStatusPending,
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			retryItemCreated, err = h.repo.CreateRetryItemIfAbsent(txCtx, retryItem)
			if err != nil {
				return err
			}
			if retryItemCreated {
				retryItemID = retryItem.ID
			}
		}

		sessionCompleted, err := h.scorer.RecalculateScores(txCtx, session)
		if err != nil {
			return err
		}

		if err := h.repo.InsertOutbox(txCtx, string(eventsadapter.AttemptEvaluated),
			attemptEvaluatedPayload(attempt.ID, session.UserID, attempt.TaskID, session.ID, passed, score, now)); err != nil {
			return err
		}
		if retryItemCreated {
			if err := h.repo.InsertOutbox(txCtx, string(eventsadapter.RetryItemCreated),
				retryItemCreatedPayload(retryItemID, session.UserID, attempt.TaskID, attempt.ID, now)); err != nil {
				return err
			}
		}
		if sessionCompleted {
			if err := h.repo.InsertOutbox(txCtx, string(eventsadapter.SessionCompleted),
				sessionCompletedPayload(session.ID, session.UserID, string(session.Mode), session.TotalScore, now)); err != nil {
				return err
			}
		}

		summary = created
		return nil
	})
	if err != nil {
		return nil, err
	}
	return summary, nil
}

func attemptEvaluatedPayload(attemptID, userID, taskID, sessionID string, passed bool, score decimal.Decimal, occurredAt time.Time) map[string]any {
	return map[string]any{
		"attempt_id":  attemptID,
		"user_id":     userID,
		"task_id":     taskID,
		"session_id":  sessionID,
		"passed":      passed,
		"score":       score.String(),
		"occurred_at": occurredAt.Format(time.RFC3339Nano),
	}
}

func retryItemCreatedPayload(retryItemID, userID, taskID, attemptID string, occurredAt time.Time) map[string]any {
	return map[string]any{
		"retry_item_id": retryItemID,
		"user_id":       userID,
		"task_id":       taskID,
		"attempt_id":    attemptID,
		"occurred_at":   occurredAt.Format(time.RFC3339Nano),
	}
}

func sessionCompletedPayload(sessionID, userID, mode string, totalScore *decimal.Decimal, occurredAt time.Time) map[string]any {
	payload := map[string]any{
		"session_id":  sessionID,
		"user_id":     userID,
		"mode":        mode,
		"occurred_at": occurredAt.Format(time.RFC3339Nano),
	}
	if totalScore != nil {
		payload["total_score"] = totalScore.String()
	}
	return payload
}
