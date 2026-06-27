package client

import (
	"context"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

// InternalClient is the service-to-service port for triggering evaluation.
type InternalClient interface {
	RunEvaluation(ctx context.Context, attemptID string) error
	GetEvaluationJob(ctx context.Context, id string) (*evaluationmodel.EvaluationJob, error)
	ListEvaluationJobs(ctx context.Context, status *evaluationmodel.JobStatus, limit int) ([]evaluationmodel.EvaluationJob, error)
}
