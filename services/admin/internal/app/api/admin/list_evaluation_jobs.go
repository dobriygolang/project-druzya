package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ListEvaluationJobs returns recent evaluation jobs.
func (i *Implementation) ListEvaluationJobs(ctx context.Context, req *adminv1.ListEvaluationJobsRequest) (*adminv1.ListEvaluationJobsResponse, error) {
	status := evaluationStatusFromProto(req.GetStatus())
	jobs, err := i.service.ListEvaluationJobs(ctx, status, int(req.GetLimit()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*adminv1.EvaluationJob, 0, len(jobs))
	for _, item := range jobs {
		out = append(out, toProtoEvaluationJob(item))
	}
	return &adminv1.ListEvaluationJobsResponse{Jobs: out}, nil
}
