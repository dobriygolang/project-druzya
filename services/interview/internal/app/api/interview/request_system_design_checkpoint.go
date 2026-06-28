package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// RequestSystemDesignCheckpoint runs AI critique for the current phase.
func (i *Implementation) RequestSystemDesignCheckpoint(
	ctx context.Context,
	req *interviewv1.RequestSystemDesignCheckpointRequest,
) (*interviewv1.RequestSystemDesignCheckpointResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}

	turn, err := i.service.RequestSystemDesignCheckpoint(ctx, userID, req.GetSessionTaskId(), req.DiagramPngBase64)
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoTurn, err := toProtoSystemDesignTurn(turn)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}
	return &interviewv1.RequestSystemDesignCheckpointResponse{SystemTurn: protoTurn}, nil
}
