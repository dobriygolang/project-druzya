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

		position, err := s.repo.NextLearningPlanPosition(txCtx, event.UserID)
		if err != nil {
			return fmt.Errorf("next plan position: %w", err)
		}

		taskID := event.TaskID
		_, err = s.repo.CreateRetryTaskPlanItem(txCtx, model.LearningPlanItem{
			UserID:   event.UserID,
			Type:     model.PlanTypeRetryTask,
			TaskID:   &taskID,
			Title:    title,
			Status:   model.PlanStatusPending,
			Position: position,
			Metadata: map[string]any{
				"task_id":       event.TaskID,
				"attempt_id":    event.AttemptID,
				"retry_item_id": event.RetryItemID,
			},
		})
		if err != nil {
			return fmt.Errorf("create retry plan item: %w", err)
		}

		return nil
	})
}
