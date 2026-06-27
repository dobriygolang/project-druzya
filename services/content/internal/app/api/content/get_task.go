package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// GetTask returns a task by id or slug.
func (i *Implementation) GetTask(ctx context.Context, req *contentv1.GetTaskRequest) (*contentv1.GetTaskResponse, error) {
	if err := requireIDOrSlug(req.GetId(), req.GetSlug()); err != nil {
		return nil, err
	}

	task, err := i.service.GetTask(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.GetTaskResponse{Task: toProtoTask(task)}, nil
}
