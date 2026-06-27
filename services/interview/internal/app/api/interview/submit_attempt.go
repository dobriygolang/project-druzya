package interviewapi

import (
	"context"

	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SubmitAttempt submits an answer for a session task.
func (i *Implementation) SubmitAttempt(
	ctx context.Context,
	req *interviewv1.SubmitAttemptRequest,
) (*interviewv1.SubmitAttemptResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}

	attempt, err := i.service.SubmitAttempt(ctx, interviewservice.SubmitAttemptInput{
		UserID:        userID,
		SessionTaskID: req.GetSessionTaskId(),
		AnswerText:    optionalString(req.AnswerText),
		Code:          optionalString(req.Code),
		Language:      optionalString(req.Language),
		Attachments:   attachmentsFromProto(req.GetAttachments()),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}

	protoAttempt, err := toProtoAttempt(attempt)
	if err != nil {
		return nil, status.Error(codes.Internal, "internal error")
	}

	return &interviewv1.SubmitAttemptResponse{Attempt: protoAttempt}, nil
}
