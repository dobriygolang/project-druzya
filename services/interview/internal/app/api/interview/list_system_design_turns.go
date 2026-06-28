package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ListSystemDesignTurns returns chat/checkpoint history.
func (i *Implementation) ListSystemDesignTurns(
	ctx context.Context,
	req *interviewv1.ListSystemDesignTurnsRequest,
) (*interviewv1.ListSystemDesignTurnsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}

	turns, err := i.service.ListSystemDesignTurns(ctx, userID, req.GetSessionTaskId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*interviewv1.SystemDesignTurn, 0, len(turns))
	for idx := range turns {
		t, err := toProtoSystemDesignTurn(&turns[idx])
		if err != nil {
			return nil, status.Error(codes.Internal, "internal error")
		}
		out = append(out, t)
	}
	return &interviewv1.ListSystemDesignTurnsResponse{Turns: out}, nil
}
