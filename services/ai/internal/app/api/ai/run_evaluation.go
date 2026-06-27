package aiapi

import (
	"context"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
)

// RunEvaluation triggers evaluation for an attempt (internal RPC).
func (i *Implementation) RunEvaluation(
	ctx context.Context,
	req *aiv1.RunEvaluationRequest,
) (*aiv1.RunEvaluationResponse, error) {
	if req.GetAttemptId() == "" {
		return nil, invalidArgument("attempt_id is required")
	}
	if err := i.service.RunEvaluation(ctx, req.GetAttemptId()); err != nil {
		return nil, mapServiceError(err)
	}
	job, err := i.service.GetEvaluationJobByAttemptID(ctx, req.GetAttemptId())
	if err != nil {
		return &aiv1.RunEvaluationResponse{}, nil
	}
	return &aiv1.RunEvaluationResponse{Job: toProtoJob(job)}, nil
}
