package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// CancelSession cancels an active session for the authenticated user.
func (i *Implementation) CancelSession(
	ctx context.Context,
	req *interviewv1.CancelSessionRequest,
) (*interviewv1.CancelSessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionId() == "" {
		return nil, invalidArgument("session_id is required")
	}

	session, err := i.service.CancelSession(ctx, userID, req.GetSessionId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	return &interviewv1.CancelSessionResponse{Session: toProtoSession(session)}, nil
}
