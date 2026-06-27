package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// GetEvaluationSummaryInternal returns evaluation summary for downstream services.
func (i *Implementation) GetEvaluationSummaryInternal(
	ctx context.Context,
	req *interviewv1.GetEvaluationSummaryInternalRequest,
) (*interviewv1.GetEvaluationSummaryInternalResponse, error) {
	if req.GetAttemptId() == "" {
		return nil, invalidArgument("attempt_id is required")
	}
	summary, err := i.service.GetEvaluationSummaryInternal(ctx, req.GetAttemptId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoSummary, err := toProtoEvaluationSummary(summary)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &interviewv1.GetEvaluationSummaryInternalResponse{Summary: protoSummary}, nil
}
