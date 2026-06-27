package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// GetInterviewSession returns session details for the authenticated user.
func (i *Implementation) GetInterviewSession(
	ctx context.Context,
	req *interviewv1.GetInterviewSessionRequest,
) (*interviewv1.GetInterviewSessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionId() == "" {
		return nil, invalidArgument("session_id is required")
	}

	detail, err := i.service.GetInterviewSession(ctx, userID, req.GetSessionId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	session, sections, tasks, progress := toProtoSessionDetail(detail)
	return &interviewv1.GetInterviewSessionResponse{
		Session:  session,
		Sections: sections,
		Tasks:    tasks,
		Progress: progress,
	}, nil
}
