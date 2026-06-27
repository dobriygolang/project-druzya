package service

import (
	"context"
	"fmt"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/usecase/command/run_evaluation"
)

// RunEvaluation delegates to the run_evaluation CQRS command handler.
func (s *evaluationService) RunEvaluation(ctx context.Context, attemptID string) error {
	return s.runEvaluation.Handle(ctx, run_evaluation.Command{AttemptID: attemptID})
}

func (s *evaluationService) GetEvaluationJob(ctx context.Context, id string) (*evaluationmodel.EvaluationJob, error) {
	if id == "" {
		return nil, fmt.Errorf("id required: %w", ErrInvalidInput)
	}
	return s.repo.GetJobByID(ctx, id)
}

func (s *evaluationService) GetEvaluationJobByAttemptID(ctx context.Context, attemptID string) (*evaluationmodel.EvaluationJob, error) {
	if attemptID == "" {
		return nil, fmt.Errorf("attempt_id required: %w", ErrInvalidInput)
	}
	return s.repo.GetJobByAttemptID(ctx, attemptID)
}

func (s *evaluationService) ListEvaluationJobs(ctx context.Context, status *evaluationmodel.JobStatus, limit int) ([]evaluationmodel.EvaluationJob, error) {
	return s.repo.ListJobs(ctx, status, limit)
}
