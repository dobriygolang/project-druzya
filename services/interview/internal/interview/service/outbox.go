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

func (s *interviewService) GetEvaluationSummaryInternal(ctx context.Context, attemptID string) (*interviewmodel.EvaluationSummary, error) {
	if attemptID == "" {
		return nil, fmt.Errorf("attempt_id required: %w", ErrInvalidInput)
	}
	return s.repo.GetEvaluationSummaryByAttemptID(ctx, attemptID)
}

func (s *interviewService) ListRetryItemsInternal(ctx context.Context, userID string, status *interviewmodel.RetryItemStatus) ([]interviewmodel.RetryItem, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}
	return s.repo.ListRetryItems(ctx, userID, status)
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
