package trackerapi

import (
	"context"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	trackerservice "github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/service"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func (i *Implementation) ListWorkTasks(ctx context.Context, _ *trackerv1.ListWorkTasksRequest) (*trackerv1.ListWorkTasksResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	tasks, err := i.svc.ListWorkTasks(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &trackerv1.ListWorkTasksResponse{}
	for _, t := range tasks {
		out.Tasks = append(out.Tasks, workTaskToProto(t))
	}
	return out, nil
}

func (i *Implementation) CreateWorkTask(ctx context.Context, req *trackerv1.CreateWorkTaskRequest) (*trackerv1.CreateWorkTaskResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	task, err := i.svc.CreateWorkTask(ctx, userID, trackerservice.CreateWorkTaskParams{
		Kind: req.GetKind(), Title: req.GetTitle(), BriefMd: req.GetBriefMd(),
		SkillKey: req.GetSkillKey(), DeepLink: req.GetDeepLink(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.CreateWorkTaskResponse{Task: workTaskToProto(*task)}, nil
}

func (i *Implementation) UpdateWorkTaskStatus(ctx context.Context, req *trackerv1.UpdateWorkTaskStatusRequest) (*trackerv1.UpdateWorkTaskStatusResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	task, err := i.svc.UpdateWorkTaskStatus(ctx, userID, req.GetId(), req.GetStatus())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.UpdateWorkTaskStatusResponse{Task: workTaskToProto(*task)}, nil
}

func (i *Implementation) DeleteWorkTask(ctx context.Context, req *trackerv1.DeleteWorkTaskRequest) (*trackerv1.DeleteWorkTaskResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.svc.DeleteWorkTask(ctx, userID, req.GetId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.DeleteWorkTaskResponse{}, nil
}

func (i *Implementation) ScheduleWorkTask(ctx context.Context, req *trackerv1.ScheduleWorkTaskRequest) (*trackerv1.ScheduleWorkTaskResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	task, err := i.svc.ScheduleWorkTask(ctx, userID, req.GetId(), req.GetScheduledStartIso(), int(req.GetDurationMin()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.ScheduleWorkTaskResponse{Task: workTaskToProto(*task)}, nil
}

func (i *Implementation) UnscheduleWorkTask(ctx context.Context, req *trackerv1.UnscheduleWorkTaskRequest) (*trackerv1.UnscheduleWorkTaskResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	task, err := i.svc.UnscheduleWorkTask(ctx, userID, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.UnscheduleWorkTaskResponse{Task: workTaskToProto(*task)}, nil
}

func (i *Implementation) UpdateWorkTaskKind(ctx context.Context, req *trackerv1.UpdateWorkTaskKindRequest) (*trackerv1.UpdateWorkTaskKindResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	task, err := i.svc.UpdateWorkTaskKind(ctx, userID, req.GetId(), req.GetKind(), req.GetManualOverride())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.UpdateWorkTaskKindResponse{Task: workTaskToProto(*task)}, nil
}

func workTaskToProto(t trackerservice.WorkTask) *trackerv1.WorkTask {
	out := &trackerv1.WorkTask{
		Id: t.ID, Status: t.Status, Kind: t.Kind, Source: t.Source,
		Title: t.Title, BriefMd: t.BriefMd, SkillKey: t.SkillKey, DeepLink: t.DeepLink,
		Priority: int32(t.Priority), ManualKindOverride: t.ManualKindOverride,
		CreatedAt: timestamppb.New(t.CreatedAt), UpdatedAt: timestamppb.New(t.UpdatedAt),
	}
	if t.CompletedAt != nil {
		out.CompletedAt = timestamppb.New(*t.CompletedAt)
	}
	if t.ScheduledStart != nil {
		out.ScheduledStart = timestamppb.New(*t.ScheduledStart)
	}
	if t.ScheduledDurationMin != nil {
		v := int32(*t.ScheduledDurationMin)
		out.ScheduledDurationMin = &v
	}
	return out
}
