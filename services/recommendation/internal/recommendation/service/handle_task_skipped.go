package service

import (
	"context"
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

func (s *recommendationService) HandleTaskSkipped(ctx context.Context, eventID string, event model.TaskSkippedEvent) error {
	processed, err := s.repo.IsEventProcessed(ctx, model.ConsumerTaskSkipped, eventID)
	if err != nil {
		return fmt.Errorf("check event processed: %w", err)
	}
	if processed {
		return nil
	}

	return s.repo.WithTx(ctx, func(txCtx context.Context) error {
		claimed, err := s.repo.ClaimEvent(txCtx, model.ConsumerTaskSkipped, eventID)
		if err != nil {
			return fmt.Errorf("claim event: %w", err)
		}
		if !claimed {
			return nil
		}
		if err := s.repo.EnsureUserProfile(txCtx, event.UserID); err != nil {
			return fmt.Errorf("ensure user profile: %w", err)
		}
		return nil
	})
}
