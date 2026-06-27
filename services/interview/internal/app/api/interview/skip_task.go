package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// SkipTask marks a session task as skipped and advances session progress.
func (i *Implementation) SkipTask(
	ctx context.Context,
	req *interviewv1.SkipTaskRequest,
) (*interviewv1.SkipTaskResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetSessionTaskId() == "" {
		return nil, invalidArgument("session_task_id is required")
	}

	task, progress, err := i.service.SkipTask(ctx, userID, req.GetSessionTaskId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	return &interviewv1.SkipTaskResponse{
		Task:     toProtoSessionTask(task),
		Progress: toProtoProgress(progress),
	}, nil
}
