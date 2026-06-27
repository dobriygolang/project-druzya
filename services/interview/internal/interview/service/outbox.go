package service

import (
	"context"
	"fmt"
	"time"

	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

const defaultOutboxClaimLimit = 20

func (s *interviewService) GetAttemptInternal(ctx context.Context, attemptID string) (*interviewmodel.Attempt, error) {
	if attemptID == "" {
		return nil, fmt.Errorf("attempt_id required: %w", ErrInvalidInput)
	}
	return s.repo.GetAttemptByID(ctx, attemptID)
}

func (s *interviewService) ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]interviewmodel.OutboxMessage, error) {
	if eventName == "" {
		eventName = string(eventsadapter.AttemptSubmitted)
	}
	if limit <= 0 {
		limit = defaultOutboxClaimLimit
	}
	return s.repo.ClaimOutboxEvents(ctx, eventName, limit)
}

func (s *interviewService) AckOutboxEvents(ctx context.Context, ids []string) error {
	return s.repo.AckOutboxEvents(ctx, ids)
}

func (s *interviewService) FailOutboxEvent(ctx context.Context, id, errMsg string) error {
	if id == "" {
		return fmt.Errorf("event id required: %w", ErrInvalidInput)
	}
	delay := time.Minute
	return s.repo.FailOutboxEvent(ctx, id, errMsg, delay)
}

func attemptSubmittedPayload(attempt *interviewmodel.Attempt, sessionID, sessionTaskID string, occurredAt time.Time) map[string]any {
	return map[string]any{
		"attempt_id":      attempt.ID,
		"user_id":         attempt.UserID,
		"task_id":         attempt.TaskID,
		"session_id":      sessionID,
		"session_task_id": sessionTaskID,
		"occurred_at":     occurredAt.Format(time.RFC3339Nano),
	}
}
