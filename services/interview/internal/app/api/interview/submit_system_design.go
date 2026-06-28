package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SubmitSystemDesign finalizes the workspace and triggers evaluation.
func (i *Implementation) SubmitSystemDesign(
	ctx context.Context,
	req *interviewv1.SubmitSystemDesignRequest,
) (*interviewv1.SubmitSystemDesignResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}

	attempt, err := i.service.SubmitSystemDesign(ctx, userID, req.GetSessionTaskId(), req.DiagramPngBase64)
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoAttempt, err := toProtoAttempt(attempt)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}
	return &interviewv1.SubmitSystemDesignResponse{Attempt: protoAttempt}, nil
}
