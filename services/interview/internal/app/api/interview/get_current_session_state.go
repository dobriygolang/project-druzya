package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// GetCurrentSessionState returns the current section and task for a session.
func (i *Implementation) GetCurrentSessionState(
	ctx context.Context,
	req *interviewv1.GetCurrentSessionStateRequest,
) (*interviewv1.GetCurrentSessionStateResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionId() == "" {
		return nil, invalidArgument("session_id is required")
	}

	state, err := i.service.GetCurrentSessionState(ctx, userID, req.GetSessionId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	return &interviewv1.GetCurrentSessionStateResponse{
		Session:        toProtoSession(state.Session),
		Sections:       toProtoSessionSections(state.Sections),
		CurrentSection: toProtoSessionSection(state.CurrentSection),
		CurrentTask:    toProtoSessionTask(state.CurrentTask),
		Progress:       toProtoProgress(state.Progress),
	}, nil
}
