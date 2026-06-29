package trackerapi

import (
	"context"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	trackerservice "github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/service"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func (i *Implementation) ClaimOutboxEvents(ctx context.Context, req *trackerv1.ClaimOutboxEventsRequest) (*trackerv1.ClaimOutboxEventsResponse, error) {
	eventName := "*"
	if req.EventName != nil {
		eventName = *req.EventName
	}
	events, err := i.svc.ClaimOutboxEvents(ctx, eventName, int(req.GetLimit()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*trackerv1.OutboxEvent, 0, len(events))
	for _, ev := range events {
		payload, _ := structpb.NewStruct(ev.Payload)
		out = append(out, &trackerv1.OutboxEvent{
			Id: ev.ID, EventName: ev.EventName, Payload: payload,
			OccurredAt: timestamppb.New(ev.CreatedAt),
		})
	}
	return &trackerv1.ClaimOutboxEventsResponse{Events: out}, nil
}

func (i *Implementation) AckOutboxEvents(ctx context.Context, req *trackerv1.AckOutboxEventsRequest) (*trackerv1.AckOutboxEventsResponse, error) {
	if err := i.svc.AckOutboxEvents(ctx, req.GetEventIds()); err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.AckOutboxEventsResponse{}, nil
}

func (i *Implementation) FailOutboxEvent(ctx context.Context, req *trackerv1.FailOutboxEventRequest) (*trackerv1.FailOutboxEventResponse, error) {
	if err := i.svc.FailOutboxEvent(ctx, req.GetEventId(), req.GetError()); err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.FailOutboxEventResponse{}, nil
}

func (i *Implementation) EnsureLearningBoard(ctx context.Context, req *trackerv1.EnsureLearningBoardRequest) (*trackerv1.EnsureLearningBoardResponse, error) {
	b, err := i.svc.EnsureLearningBoard(ctx, req.GetUserId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.EnsureLearningBoardResponse{ProjectId: b.ProjectID, SprintId: b.SprintID}, nil
}

func (i *Implementation) CreateTaskInternal(ctx context.Context, req *trackerv1.CreateTaskInternalRequest) (*trackerv1.CreateTaskInternalResponse, error) {
	t, created, err := i.svc.CreateTaskInternal(ctx, trackerservice.InternalCreateTaskParams{
		UserID: req.GetUserId(), Title: req.GetTitle(), Source: taskSourceFromProto(req.GetSource()),
		Metadata: metadataFromProto(req.GetMetadata()), DedupKey: req.DedupKey, EpicName: req.EpicName,
		EstimateDays: protoEstimateDays(req.EstimateDays),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.CreateTaskInternalResponse{Task: taskToProto(t), Created: created}, nil
}

func (i *Implementation) GetSprintPreview(ctx context.Context, req *trackerv1.GetSprintPreviewRequest) (*trackerv1.GetSprintPreviewResponse, error) {
	tasks, sprint, err := i.svc.GetSprintPreview(ctx, req.GetUserId(), int(req.GetLimit()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*trackerv1.Task, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, taskToProto(&t))
	}
	return &trackerv1.GetSprintPreviewResponse{Tasks: out, Sprint: sprintToProto(sprint)}, nil
}

func (i *Implementation) GetUserSettings(ctx context.Context, req *trackerv1.GetUserSettingsRequest) (*trackerv1.GetUserSettingsResponse, error) {
	settings, err := i.svc.GetUserSettings(ctx, req.GetUserId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.GetUserSettingsResponse{Settings: userSettingsToProto(settings)}, nil
}

func (i *Implementation) PatchTaskMetadata(ctx context.Context, req *trackerv1.PatchTaskMetadataRequest) (*trackerv1.PatchTaskMetadataResponse, error) {
	t, err := i.svc.PatchTaskMetadata(ctx, req.GetUserId(), req.GetTaskId(), metadataFromProto(req.GetMetadata()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.PatchTaskMetadataResponse{Task: taskToProto(t)}, nil
}
