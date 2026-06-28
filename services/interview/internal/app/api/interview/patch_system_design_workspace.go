package interviewapi

import (
	"context"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// PatchSystemDesignWorkspace autosaves workspace fields with optimistic locking.
func (i *Implementation) PatchSystemDesignWorkspace(
	ctx context.Context,
	req *interviewv1.PatchSystemDesignWorkspaceRequest,
) (*interviewv1.PatchSystemDesignWorkspaceResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}
	if req.GetExpectedVersion() <= 0 {
		return nil, invalidArgument("expected_version is required")
	}

	in := interviewmodel.PatchSystemDesignWorkspaceInput{
		UserID:            userID,
		SessionTaskID:     req.GetSessionTaskId(),
		ExpectedVersion:   int(req.GetExpectedVersion()),
		FunctionalContext: optionalStructToRawJSON(req.FunctionalContext),
		NFR:               optionalStructToRawJSON(req.Nfr),
		Diagram:           optionalStructToRawJSON(req.Diagram),
		APISpec:           optionalStructToRawJSON(req.ApiSpec),
		DataModel:         optionalStructToRawJSON(req.DataModel),
		Infrastructure:    optionalStructToRawJSON(req.Infrastructure),
		WrapUp:            req.WrapUp,
	}
	if req.Phase != nil {
		phase, err := sdPhaseFromProto(*req.Phase)
		if err != nil {
			return nil, err
		}
		in.Phase = &phase
	}

	ws, err := i.service.PatchSystemDesignWorkspace(ctx, in)
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoWS, err := toProtoSystemDesignWorkspace(ws)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}
	return &interviewv1.PatchSystemDesignWorkspaceResponse{Workspace: protoWS}, nil
}
