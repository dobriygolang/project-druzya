package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// ResumeSession resumes a paused session and re-consumes mock quota when applicable.
func (i *Implementation) ResumeSession(
	ctx context.Context,
	req *interviewv1.ResumeSessionRequest,
) (*interviewv1.ResumeSessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionId() == "" {
		return nil, invalidArgument("session_id is required")
	}

	detail, err := i.service.ResumeSession(ctx, userID, req.GetSessionId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	_, sections, tasks, progress := toProtoSessionDetail(detail)
	_ = sections
	_ = tasks
	return &interviewv1.ResumeSessionResponse{
		Session:  toProtoSession(detail.Session),
		Progress: progress,
	}, nil
}
