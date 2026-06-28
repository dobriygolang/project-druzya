package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// GetActiveSession returns the user's current active session, if any.
func (i *Implementation) GetActiveSession(
	ctx context.Context,
	_ *interviewv1.GetActiveSessionRequest,
) (*interviewv1.GetActiveSessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	detail, err := i.service.GetActiveSession(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if detail == nil || detail.Session == nil {
		return &interviewv1.GetActiveSessionResponse{}, nil
	}

	session, sections, tasks, progress := toProtoSessionDetail(detail)
	_ = sections
	_ = tasks
	return &interviewv1.GetActiveSessionResponse{
		Session:  session,
		Progress: progress,
	}, nil
}
