package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// GetEvaluationJob returns one evaluation job.
func (i *Implementation) GetEvaluationJob(ctx context.Context, req *adminv1.GetEvaluationJobRequest) (*adminv1.GetEvaluationJobResponse, error) {
	job, err := i.service.GetEvaluationJob(ctx, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.GetEvaluationJobResponse{Job: toProtoEvaluationJob(*job)}, nil
}
