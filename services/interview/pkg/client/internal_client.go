package client

import (
	"context"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
)

// InternalClient is the service-to-service port for ai-service and workers.
type InternalClient interface {
	CompleteEvaluation(ctx context.Context, input interviewservice.CompleteEvaluationInput) (*interviewmodel.EvaluationSummary, error)
	FailEvaluation(ctx context.Context, input interviewservice.FailEvaluationInput) error
}
