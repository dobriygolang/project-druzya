package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GetSystemDesignWorkspace loads or creates the SD workspace for a session task.
func (i *Implementation) GetSystemDesignWorkspace(
	ctx context.Context,
	req *interviewv1.GetSystemDesignWorkspaceRequest,
) (*interviewv1.GetSystemDesignWorkspaceResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}

	bundle, err := i.service.GetSystemDesignWorkspace(ctx, userID, req.GetSessionTaskId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	ws, err := toProtoSystemDesignWorkspace(bundle.Workspace)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}
	turns := make([]*interviewv1.SystemDesignTurn, 0, len(bundle.RecentTurns))
	for idx := range bundle.RecentTurns {
		t, err := toProtoSystemDesignTurn(&bundle.RecentTurns[idx])
		if err != nil {
			return nil, status.Error(codes.Internal, "internal error")
		}
		turns = append(turns, t)
	}
	return &interviewv1.GetSystemDesignWorkspaceResponse{Workspace: ws, RecentTurns: turns}, nil
}
