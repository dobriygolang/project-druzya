package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GetSessionResults returns evaluations and progress for a session.
func (i *Implementation) GetSessionResults(
	ctx context.Context,
	req *interviewv1.GetSessionResultsRequest,
) (*interviewv1.GetSessionResultsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionId() == "" {
		return nil, invalidArgument("session_id is required")
	}

	results, err := i.service.GetSessionResults(ctx, userID, req.GetSessionId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	session, sections, tasks, evaluations, progress, err := toProtoSessionResults(results)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}

	return &interviewv1.GetSessionResultsResponse{
		Session:     session,
		Sections:    sections,
		Tasks:       tasks,
		Evaluations: evaluations,
		Progress:    progress,
	}, nil
}
