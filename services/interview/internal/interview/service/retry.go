package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

func (s *interviewService) ListRetryItems(
	ctx context.Context,
	userID string,
	status *interviewmodel.RetryItemStatus,
) ([]interviewmodel.RetryItem, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}
	return s.repo.ListRetryItems(ctx, userID, status)
}

func (s *interviewService) StartRetrySession(
	ctx context.Context,
	userID string,
	retryItemIDs []string,
) (*interviewmodel.SessionDetail, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}

	var items []interviewmodel.RetryItem
	var err error
	if len(retryItemIDs) > 0 {
		items, err = s.repo.GetRetryItemsByIDs(ctx, userID, retryItemIDs)
		if err != nil {
			return nil, err
		}
		if len(items) != len(retryItemIDs) {
			return nil, fmt.Errorf("retry items unavailable: %w", ErrNotFound)
		}
	} else {
		items, err = s.repo.ListPendingRetryItems(ctx, userID)
	}
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("no retry items: %w", ErrNotFound)
	}

	now := time.Now().UTC()
	sessionID := uuid.NewString()
	secID := uuid.NewString()
	section := interviewmodel.SessionSection{
		ID:          secID,
		SessionID:   sessionID,
		SectionType: "retry",
		Title:       "Retry mistakes",
		Position:    1,
		Status:      interviewmodel.SectionStatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	tasks := make([]interviewmodel.SessionTask, 0, len(items))
	itemIDs := make([]string, 0, len(items))
	for i, item := range items {
		if _, err := s.content.GetTask(ctx, item.TaskID); err != nil {
			return nil, mapContentError(err)
		}
		itemIDs = append(itemIDs, item.ID)
		tasks = append(tasks, interviewmodel.SessionTask{
			ID:        uuid.NewString(),
			SessionID: sessionID,
			SectionID: secID,
			TaskID:    item.TaskID,
			Position:  i + 1,
			Status:    interviewmodel.SessionTaskAssigned,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}

	session := interviewmodel.Session{
		ID:           sessionID,
		UserID:       userID,
		Mode:         interviewmodel.ModeRetryMistakes,
		Status:       interviewmodel.SessionStatusActive,
		StartedAt:    now,
		PassingScore: 85,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.CreateRetrySession(ctx, interviewrepo.SessionBundle{
		Session:  session,
		Sections: []interviewmodel.SessionSection{section},
		Tasks:    tasks,
	}, itemIDs, now); err != nil {
		return nil, err
	}

	_ = s.events.Publish(ctx, eventsadapter.Event{
		Name: eventsadapter.SessionStarted,
		Payload: map[string]any{
			"session_id": sessionID,
			"user_id":    userID,
			"mode":       string(interviewmodel.ModeRetryMistakes),
		},
	})

	return &interviewmodel.SessionDetail{
		Session:  &session,
		Sections: []interviewmodel.SessionSection{section},
		Tasks:    tasks,
		Progress: computeProgress([]interviewmodel.SessionSection{section}, tasks),
	}, nil
}

func (s *interviewService) DismissRetryItem(ctx context.Context, userID, retryItemID string) (*interviewmodel.RetryItem, error) {
	if userID == "" || retryItemID == "" {
		return nil, fmt.Errorf("user_id and retry_item_id required: %w", ErrInvalidInput)
	}

	item, err := s.repo.GetRetryItemForUser(ctx, userID, retryItemID)
	if err != nil {
		return nil, err
	}
	if item.Status != interviewmodel.RetryStatusPending {
		return nil, fmt.Errorf("retry item not dismissable: %w", ErrConflict)
	}

	now := time.Now().UTC()
	item.Status = interviewmodel.RetryStatusDismissed
	item.ResolvedAt = &now
	item.UpdatedAt = now
	if err := s.repo.UpdateRetryItem(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}
