package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// PauseSession pauses an active session and releases mock quota while paused.
func (i *Implementation) PauseSession(
	ctx context.Context,
	req *interviewv1.PauseSessionRequest,
) (*interviewv1.PauseSessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionId() == "" {
		return nil, invalidArgument("session_id is required")
	}

	session, err := i.service.PauseSession(ctx, userID, req.GetSessionId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	return &interviewv1.PauseSessionResponse{Session: toProtoSession(session)}, nil
}
