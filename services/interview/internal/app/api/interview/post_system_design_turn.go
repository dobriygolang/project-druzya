package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// PostSystemDesignTurn sends a user message and returns AI interviewer reply.
func (i *Implementation) PostSystemDesignTurn(
	ctx context.Context,
	req *interviewv1.PostSystemDesignTurnRequest,
) (*interviewv1.PostSystemDesignTurnResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}

	userTurn, interviewerTurn, err := i.service.PostSystemDesignTurn(ctx, userID, req.GetSessionTaskId(), req.GetContent())
	if err != nil {
		return nil, mapServiceError(err)
	}
	userProto, err := toProtoSystemDesignTurn(userTurn)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}
	interviewerProto, err := toProtoSystemDesignTurn(interviewerTurn)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}
	return &interviewv1.PostSystemDesignTurnResponse{
		UserTurn:        userProto,
		InterviewerTurn: interviewerProto,
	}, nil
}
