package service

import (
	"context"
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/copy"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/locale"
)

func (s *recommendationService) HandleRetryItemCreated(ctx context.Context, eventID string, event model.RetryItemCreatedEvent) error {
	processed, err := s.repo.IsEventProcessed(ctx, model.ConsumerRetryItemCreated, eventID)
	if err != nil {
		return fmt.Errorf("check event processed: %w", err)
	}
	if processed {
		return nil
	}

	taskTitle := ""
	if event.TaskID != "" {
		if task, err := s.content.GetTask(ctx, event.TaskID); err == nil && task != nil {
			taskTitle = task.Title
		}
	}

	return s.repo.WithTx(ctx, func(txCtx context.Context) error {
		claimed, err := s.repo.ClaimEvent(txCtx, model.ConsumerRetryItemCreated, eventID)
		if err != nil {
			return fmt.Errorf("claim event: %w", err)
		}
		if !claimed {
			return nil
		}

		if err := s.repo.EnsureUserProfile(txCtx, event.UserID); err != nil {
			return fmt.Errorf("ensure user profile: %w", err)
		}
		lang := locale.From(ctx)
		title := copy.RetryTaskTitle(lang, taskTitle)

		s.pushRetryTrackerTask(txCtx, event.UserID, title, event.RetryItemID, event.TaskID)

		return nil
	})
}
