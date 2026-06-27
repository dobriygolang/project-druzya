package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func (s *interviewService) SubmitAttempt(ctx context.Context, input SubmitAttemptInput) (*interviewmodel.Attempt, error) {
	if input.UserID == "" || input.SessionTaskID == "" {
		return nil, fmt.Errorf("user_id and session_task_id required: %w", ErrInvalidInput)
	}
	if !hasAttemptPayload(input) {
		return nil, fmt.Errorf("answer required: %w", ErrInvalidInput)
	}

	sessionTask, err := s.repo.GetSessionTaskForUser(ctx, input.UserID, input.SessionTaskID)
	if err != nil {
		return nil, err
	}
	session, err := s.repo.GetSessionForUser(ctx, input.UserID, sessionTask.SessionID)
	if err != nil {
		return nil, err
	}
	if err := s.expireIfNeeded(ctx, session); err != nil {
		return nil, err
	}
	if err := s.ensureSessionActive(session); err != nil {
		return nil, err
	}
	if sessionTask.Status == interviewmodel.SessionTaskEvaluated || sessionTask.Status == interviewmodel.SessionTaskSkipped {
		return nil, fmt.Errorf("task already finished: %w", ErrConflict)
	}
	if sessionTask.Status == interviewmodel.SessionTaskSubmitted {
		return nil, fmt.Errorf("attempt already submitted: %w", ErrConflict)
	}

	if _, err := s.content.GetTask(ctx, sessionTask.TaskID); err != nil {
		return nil, mapContentError(err)
	}

	now := time.Now().UTC()
	attempt := &interviewmodel.Attempt{
		ID:            uuid.NewString(),
		UserID:        input.UserID,
		SessionTaskID: sessionTask.ID,
		TaskID:        sessionTask.TaskID,
		AnswerText:    input.AnswerText,
		Code:          input.Code,
		Language:      input.Language,
		Attachments:   encodeAttachments(input.Attachments),
		Status:        interviewmodel.AttemptStatusEvaluating,
		SubmittedAt:   now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	err = s.repo.WithTx(ctx, func(txCtx context.Context) error {
		if err := s.repo.CreateAttempt(txCtx, attempt); err != nil {
			return err
		}
		sessionTask.Status = interviewmodel.SessionTaskSubmitted
		sessionTask.UpdatedAt = now
		if err := s.repo.UpdateSessionTask(txCtx, sessionTask); err != nil {
			return err
		}
		return s.repo.InsertOutbox(txCtx, string(eventsadapter.AttemptSubmitted),
			attemptSubmittedPayload(attempt, session.ID, sessionTask.ID, now))
	})
	if err != nil {
		return nil, err
	}

	_ = s.events.Publish(ctx, eventsadapter.Event{
		Name:    eventsadapter.AttemptSubmitted,
		Payload: attemptSubmittedPayload(attempt, session.ID, sessionTask.ID, now),
	})

	return attempt, nil
}

func (s *interviewService) GetAttempt(ctx context.Context, userID, attemptID string) (*interviewmodel.Attempt, error) {
	return s.repo.GetAttemptForUser(ctx, userID, attemptID)
}

func hasAttemptPayload(input SubmitAttemptInput) bool {
	if input.AnswerText != nil && *input.AnswerText != "" {
		return true
	}
	if input.Code != nil && *input.Code != "" {
		return true
	}
	return len(input.Attachments) > 0
}

func emptyFeedback() json.RawMessage {
	return json.RawMessage("{}")
}
