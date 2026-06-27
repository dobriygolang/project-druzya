package aiapi

import (
	"context"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
)

// GetEvaluationJob returns one evaluation job by id.
func (i *Implementation) GetEvaluationJob(
	ctx context.Context,
	req *aiv1.GetEvaluationJobRequest,
) (*aiv1.EvaluationJob, error) {
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}
	job, err := i.service.GetEvaluationJob(ctx, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoJob(job), nil
}
