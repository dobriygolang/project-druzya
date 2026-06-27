package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// StartRetrySession starts a session from retry queue items.
func (i *Implementation) StartRetrySession(
	ctx context.Context,
	req *interviewv1.StartRetrySessionRequest,
) (*interviewv1.StartRetrySessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	detail, err := i.service.StartRetrySession(ctx, userID, req.GetRetryItemIds())
	if err != nil {
		return nil, mapServiceError(err)
	}

	session, sections, tasks, progress := toProtoSessionDetail(detail)
	return &interviewv1.StartRetrySessionResponse{
		Session:  session,
		Sections: sections,
		Tasks:    tasks,
		Progress: progress,
	}, nil
}
