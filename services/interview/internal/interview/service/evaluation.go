package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

type completeEvaluationResult struct {
	summary          *interviewmodel.EvaluationSummary
	retryItemCreated bool
	sessionCompleted bool
	sessionID        string
	userID           string
	attemptID        string
	passed           bool
	score            decimal.Decimal
	alreadyDone      bool
}

func (s *interviewService) CompleteEvaluation(ctx context.Context, input CompleteEvaluationInput) (*interviewmodel.EvaluationSummary, error) {
	if input.AttemptID == "" {
		return nil, fmt.Errorf("attempt_id required: %w", ErrInvalidInput)
	}

	var result completeEvaluationResult
	err := s.repo.WithTx(ctx, func(txCtx context.Context) error {
		attempt, err := s.repo.GetAttemptByID(txCtx, input.AttemptID)
		if err != nil {
			return err
		}

		if attempt.Status == interviewmodel.AttemptStatusEvaluated {
			summary, err := s.repo.GetEvaluationSummaryByAttemptID(txCtx, attempt.ID)
			if err != nil {
				return err
			}
			result.summary = summary
			result.alreadyDone = true
			return nil
		}
		if attempt.Status != interviewmodel.AttemptStatusEvaluating {
			return fmt.Errorf("attempt not evaluating: %w", ErrConflict)
		}

		sessionTask, err := s.repo.GetSessionTaskByID(txCtx, attempt.SessionTaskID)
		if err != nil {
			return err
		}
		session, err := s.repo.GetSessionByID(txCtx, sessionTask.SessionID)
		if err != nil {
			return err
		}

		score := decimal.NewFromFloat(input.Score)
		passed := input.Passed != nil && *input.Passed
		if input.Passed == nil {
			passed = score.GreaterThanOrEqual(decimal.NewFromInt(int64(session.PassingScore)))
		}

		now := time.Now().UTC()
		feedbackBytes, err := json.Marshal(input.Feedback)
		if err != nil || len(input.Feedback) == 0 {
			feedbackBytes = emptyFeedback()
		}

		summary := &interviewmodel.EvaluationSummary{
			ID:        uuid.NewString(),
			AttemptID: attempt.ID,
			Score:     score,
			Passed:    passed,
			Summary:   input.Summary,
			Feedback:  feedbackBytes,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.repo.CreateEvaluationSummary(txCtx, summary); err != nil {
			return err
		}

		attempt.Status = interviewmodel.AttemptStatusEvaluated
		attempt.UpdatedAt = now
		if err := s.repo.UpdateAttempt(txCtx, attempt); err != nil {
			return err
		}

		sessionTask.Status = interviewmodel.SessionTaskEvaluated
		sessionTask.UpdatedAt = now
		if err := s.repo.UpdateSessionTask(txCtx, sessionTask); err != nil {
			return err
		}

		if !passed {
			reason := "score below passing threshold"
			created, err := s.repo.CreateRetryItemIfAbsent(txCtx, &interviewmodel.RetryItem{
				ID:              uuid.NewString(),
				UserID:          attempt.UserID,
				TaskID:          attempt.TaskID,
				SourceAttemptID: attempt.ID,
				Reason:          &reason,
				Status:          interviewmodel.RetryStatusPending,
				CreatedAt:       now,
				UpdatedAt:       now,
			})
			if err != nil {
				return err
			}
			result.retryItemCreated = created
		}

		sessionCompleted, err := s.recalculateScores(txCtx, session)
		if err != nil {
			return err
		}

		result.summary = summary
		result.sessionCompleted = sessionCompleted
		result.sessionID = session.ID
		result.userID = session.UserID
		result.attemptID = attempt.ID
		result.passed = passed
		result.score = score
		return nil
	})
	if err != nil {
		return nil, err
	}
	if result.alreadyDone {
		return result.summary, nil
	}

	if result.retryItemCreated {
		_ = s.events.Publish(ctx, eventsadapter.Event{
			Name: eventsadapter.RetryItemCreated,
			Payload: map[string]any{
				"user_id":    result.userID,
				"attempt_id": result.attemptID,
			},
		})
	}

	_ = s.events.Publish(ctx, eventsadapter.Event{
		Name: eventsadapter.AttemptEvaluated,
		Payload: map[string]any{
			"attempt_id": result.attemptID,
			"session_id": result.sessionID,
			"passed":     result.passed,
			"score":      result.score.String(),
		},
	})

	if result.sessionCompleted {
		_ = s.events.Publish(ctx, eventsadapter.Event{
			Name: eventsadapter.SessionCompleted,
			Payload: map[string]any{
				"session_id": result.sessionID,
				"user_id":    result.userID,
			},
		})
	}

	return result.summary, nil
}

func (s *interviewService) recalculateScores(ctx context.Context, session *interviewmodel.Session) (bool, error) {
	evals, err := s.repo.ListEvaluationsBySession(ctx, session.ID)
	if err != nil {
		return false, err
	}

	sectionScores := map[string][]decimal.Decimal{}
	taskScores := make([]decimal.Decimal, 0, len(evals))
	for _, ev := range evals {
		taskScores = append(taskScores, ev.Summary.Score)
		sectionScores[ev.SectionID] = append(sectionScores[ev.SectionID], ev.Summary.Score)
	}

	sections, err := s.repo.ListSectionsBySession(ctx, session.ID)
	if err != nil {
		return false, err
	}
	tasks, err := s.repo.ListTasksBySession(ctx, session.ID)
	if err != nil {
		return false, err
	}

	now := time.Now().UTC()
	for i := range sections {
		scores := sectionScores[sections[i].ID]
		if len(scores) == 0 {
			continue
		}
		avg := averageDecimal(scores)
		sections[i].Score = &avg
		if sectionTasksDone(tasks, sections[i].ID) {
			sections[i].Status = interviewmodel.SectionStatusCompleted
			if i+1 < len(sections) && sections[i+1].Status == interviewmodel.SectionStatusPending {
				sections[i+1].Status = interviewmodel.SectionStatusActive
				sections[i+1].UpdatedAt = now
				if err := s.repo.UpdateSection(ctx, &sections[i+1]); err != nil {
					return false, err
				}
			}
		}
		sections[i].UpdatedAt = now
		if err := s.repo.UpdateSection(ctx, &sections[i]); err != nil {
			return false, err
		}
	}

	if len(taskScores) > 0 {
		total := averageDecimal(taskScores)
		session.TotalScore = &total
	}

	sessionCompleted := false
	if allTasksDone(tasks) {
		sessionCompleted = true
		session.Status = interviewmodel.SessionStatusCompleted
		completedAt := now
		session.CompletedAt = &completedAt
		if session.Mode == interviewmodel.ModeRetryMistakes {
			if err := s.resolveRetryItemsForSession(ctx, session.ID, now); err != nil {
				return false, err
			}
		}
	}
	session.UpdatedAt = now
	if err := s.repo.UpdateSession(ctx, session); err != nil {
		return false, err
	}
	return sessionCompleted, nil
}

func sectionTasksDone(tasks []interviewmodel.SessionTask, sectionID string) bool {
	hasTask := false
	for _, t := range tasks {
		if t.SectionID != sectionID {
			continue
		}
		hasTask = true
		switch t.Status {
		case interviewmodel.SessionTaskEvaluated, interviewmodel.SessionTaskSkipped:
			continue
		default:
			return false
		}
	}
	return hasTask
}

func averageDecimal(values []decimal.Decimal) decimal.Decimal {
	if len(values) == 0 {
		return decimal.Zero
	}
	sum := decimal.Zero
	for _, v := range values {
		sum = sum.Add(v)
	}
	return sum.Div(decimal.NewFromInt(int64(len(values))))
}

func (s *interviewService) resolveRetryItemsForSession(ctx context.Context, sessionID string, now time.Time) error {
	items, err := s.repo.ListRetryItemsBySession(ctx, sessionID)
	if err != nil {
		return err
	}
	for i := range items {
		if items[i].SessionID == nil || *items[i].SessionID != sessionID {
			continue
		}
		items[i].Status = interviewmodel.RetryStatusCompleted
		items[i].ResolvedAt = &now
		items[i].UpdatedAt = now
		if err := s.repo.UpdateRetryItem(ctx, &items[i]); err != nil {
			return err
		}
	}
	return nil
}

func mapContentError(err error) error {
	if errors.Is(err, contentadapter.ErrNotFound) {
		return fmt.Errorf("%w", ErrNotFound)
	}
	return err
}
