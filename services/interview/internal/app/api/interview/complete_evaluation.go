package interviewapi

import (
	"context"

	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// CompleteEvaluation records evaluation results for an attempt (internal RPC).
func (i *Implementation) CompleteEvaluation(
	ctx context.Context,
	req *interviewv1.CompleteEvaluationRequest,
) (*interviewv1.CompleteEvaluationResponse, error) {
	if req.GetAttemptId() == "" {
		return nil, invalidArgument("attempt_id is required")
	}

	summary, err := i.service.CompleteEvaluation(ctx, interviewservice.CompleteEvaluationInput{
		AttemptID: req.GetAttemptId(),
		Score:     req.GetScore(),
		Passed:    req.Passed,
		Summary:   optionalString(req.Summary),
		Feedback:  structToMap(req.GetFeedback()),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}

	protoSummary, err := toProtoEvaluationSummary(summary)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}

	return &interviewv1.CompleteEvaluationResponse{Summary: protoSummary}, nil
}
