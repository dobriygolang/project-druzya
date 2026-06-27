package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// ListTasks returns catalog tasks.
func (i *Implementation) ListTasks(ctx context.Context, req *contentv1.ListTasksRequest) (*contentv1.ListTasksResponse, error) {
	items, err := i.service.ListTasks(
		ctx,
		optionalString(req.Type),
		optionalString(req.Difficulty),
		optionalString(req.Status),
		int(req.GetLimit()),
		int(req.GetOffset()),
	)
	if err != nil {
		return nil, mapServiceError(err)
	}

	tasks := make([]*contentv1.Task, 0, len(items))
	for idx := range items {
		tasks = append(tasks, toProtoTask(&items[idx]))
	}
	return &contentv1.ListTasksResponse{Tasks: tasks}, nil
}
