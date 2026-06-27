package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GetAttempt returns an attempt for the authenticated user.
func (i *Implementation) GetAttempt(
	ctx context.Context,
	req *interviewv1.GetAttemptRequest,
) (*interviewv1.GetAttemptResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetAttemptId() == "" {
		return nil, invalidArgument("attempt_id is required")
	}

	attempt, err := i.service.GetAttempt(ctx, userID, req.GetAttemptId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	protoAttempt, err := toProtoAttempt(attempt)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}

	return &interviewv1.GetAttemptResponse{Attempt: protoAttempt}, nil
}
