package trackerapi

import (
	"context"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	trackerservice "github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/service"
)

func (i *Implementation) GetBoard(ctx context.Context, req *trackerv1.GetBoardRequest) (*trackerv1.GetBoardResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	var projectID *string
	if req.ProjectId != nil {
		projectID = req.ProjectId
	}
	board, err := i.svc.GetBoard(ctx, userID, projectID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.GetBoardResponse{Board: boardToProto(board)}, nil
}

func (i *Implementation) CreateProject(ctx context.Context, req *trackerv1.CreateProjectRequest) (*trackerv1.CreateProjectResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	p, err := i.svc.CreateProject(ctx, userID, req.GetName())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.CreateProjectResponse{Project: projectToProto(p)}, nil
}

func (i *Implementation) CreateEpic(ctx context.Context, req *trackerv1.CreateEpicRequest) (*trackerv1.CreateEpicResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	e, err := i.svc.CreateEpic(ctx, userID, req.GetProjectId(), req.GetName())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.CreateEpicResponse{Epic: epicToProto(e)}, nil
}

func (i *Implementation) CreateSprint(ctx context.Context, req *trackerv1.CreateSprintRequest) (*trackerv1.CreateSprintResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	s, err := i.svc.CreateSprint(ctx, userID, req.GetProjectId(), req.Name, req.Goal)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.CreateSprintResponse{Sprint: sprintToProto(s)}, nil
}

func (i *Implementation) CreateTask(ctx context.Context, req *trackerv1.CreateTaskRequest) (*trackerv1.CreateTaskResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	source := taskSourceFromProto(req.GetSource())
	t, err := i.svc.CreateTask(ctx, userID, trackerservice.CreateTaskParams{
		SprintID: req.GetSprintId(), Title: req.GetTitle(), EpicID: req.EpicId,
		Source: source, Metadata: metadataFromProto(req.GetMetadata()), DedupKey: req.DedupKey,
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.CreateTaskResponse{Task: taskToProto(t)}, nil
}

func (i *Implementation) UpdateTask(ctx context.Context, req *trackerv1.UpdateTaskRequest) (*trackerv1.UpdateTaskResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	t, err := i.svc.UpdateTask(ctx, userID, trackerservice.UpdateTaskParams{
		TaskID: req.GetId(), Title: req.Title, Done: req.Done, EpicID: req.EpicId, Position: int32Ptr(req.Position),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.UpdateTaskResponse{Task: taskToProto(t)}, nil
}

func (i *Implementation) ArchiveSprint(ctx context.Context, req *trackerv1.ArchiveSprintRequest) (*trackerv1.ArchiveSprintResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	s, err := i.svc.ArchiveSprint(ctx, userID, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.ArchiveSprintResponse{Sprint: sprintToProto(s)}, nil
}

func (i *Implementation) ExportBoard(ctx context.Context, req *trackerv1.ExportBoardRequest) (*trackerv1.ExportBoardResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	md, err := i.svc.ExportBoard(ctx, userID, req.ProjectId)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.ExportBoardResponse{Markdown: md}, nil
}

func int32Ptr(v *int32) *int {
	if v == nil {
		return nil
	}
	i := int(*v)
	return &i
}
