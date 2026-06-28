package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ListTasks returns catalog tasks for admin UI.
func (i *Implementation) ListTasks(ctx context.Context, req *adminv1.ListTasksRequest) (*adminv1.ListTasksResponse, error) {
	filter := contentadapter.ListTasksFilter{
		Limit:  int(req.GetLimit()),
		Offset: int(req.GetOffset()),
	}
	if req.Type != nil {
		filter.Type = req.Type
	}
	if req.Difficulty != nil {
		filter.Difficulty = req.Difficulty
	}
	if req.Status != nil {
		filter.Status = req.Status
	}
	items, err := i.service.ListTasks(ctx, filter)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*adminv1.Task, 0, len(items))
	for _, item := range items {
		task, err := toProtoTask(item)
		if err != nil {
			return nil, mapServiceError(err)
		}
		out = append(out, task)
	}
	return &adminv1.ListTasksResponse{Tasks: out}, nil
}

// GetTask returns one task by id or slug with reference solutions.
func (i *Implementation) GetTask(ctx context.Context, req *adminv1.GetTaskRequest) (*adminv1.GetTaskResponse, error) {
	detail, err := i.service.GetTask(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoTask, err := toProtoTask(detail.Task)
	if err != nil {
		return nil, mapServiceError(err)
	}
	outSolutions := make([]*adminv1.TaskSolution, 0, len(detail.Solutions))
	for _, sol := range detail.Solutions {
		outSolutions = append(outSolutions, toProtoSolution(sol))
	}
	return &adminv1.GetTaskResponse{Task: protoTask, Solutions: outSolutions}, nil
}

// UpsertTask creates or updates a task.
func (i *Implementation) UpsertTask(ctx context.Context, req *adminv1.UpsertTaskRequest) (*adminv1.UpsertTaskResponse, error) {
	meta, err := structToRawJSON(req.GetMetadata())
	if err != nil {
		return nil, invalidArgument("invalid metadata")
	}
	input := contentadapter.UpsertTaskInput{
		ID:          optionalString(req.Id),
		Slug:        req.GetSlug(),
		Type:        req.GetType(),
		Title:       req.GetTitle(),
		Description: req.GetDescription(),
		Difficulty:  req.GetDifficulty(),
		Metadata:    meta,
		Status:      req.GetStatus(),
	}
	if req.EstimatedMinutes != nil {
		v := int(req.GetEstimatedMinutes())
		input.EstimatedMinutes = &v
	}
	task, err := i.service.UpsertTask(ctx, input)
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoTask, err := toProtoTask(*task)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.UpsertTaskResponse{Task: protoTask}, nil
}
