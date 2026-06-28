package interviewapi

import (
	"context"

	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// FailEvaluation marks an attempt as permanently failed (internal RPC).
func (i *Implementation) FailEvaluation(
	ctx context.Context,
	req *interviewv1.FailEvaluationRequest,
) (*interviewv1.FailEvaluationResponse, error) {
	if req.GetAttemptId() == "" {
		return nil, invalidArgument("attempt_id is required")
	}
	if err := i.service.FailEvaluation(ctx, interviewservice.FailEvaluationInput{
		AttemptID: req.GetAttemptId(),
		Reason:    req.Reason,
	}); err != nil {
		return nil, mapServiceError(err)
	}
	return &interviewv1.FailEvaluationResponse{}, nil
}
