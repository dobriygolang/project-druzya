package service

import (
	"context"
	"fmt"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/correlation"
)

func (s *evaluationService) HandleAttemptSubmitted(ctx context.Context, event evaluationmodel.AttemptSubmittedEvent) error {
	if event.AttemptID == "" {
		return fmt.Errorf("attempt_id required: %w", ErrInvalidInput)
	}
	ctx = correlation.WithAttemptID(ctx, event.AttemptID)

	completed, err := s.runEvaluation.EnsureJob(ctx, event.AttemptID, event.UserID, event.TaskID)
	if err != nil {
		return err
	}
	if completed {
		return nil
	}
	return s.RunEvaluation(ctx, event.AttemptID)
}
