package aiapi

import (
	"context"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
)

// ListEvaluationJobs returns evaluation jobs with optional status filter.
func (i *Implementation) ListEvaluationJobs(
	ctx context.Context,
	req *aiv1.ListEvaluationJobsRequest,
) (*aiv1.ListEvaluationJobsResponse, error) {
	status := jobStatusFromProto(req.GetStatus())
	jobs, err := i.service.ListEvaluationJobs(ctx, status, int(req.GetLimit()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*aiv1.EvaluationJob, 0, len(jobs))
	for i := range jobs {
		out = append(out, toProtoJob(&jobs[i]))
	}
	return &aiv1.ListEvaluationJobsResponse{Jobs: out}, nil
}
