package interviewapi

import (
	"context"
	"time"

	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// GetAttemptInternal returns attempt data for ai-service (internal RPC).
func (i *Implementation) GetAttemptInternal(
	ctx context.Context,
	req *interviewv1.GetAttemptInternalRequest,
) (*interviewv1.GetAttemptResponse, error) {
	if req.GetAttemptId() == "" {
		return nil, invalidArgument("attempt_id is required")
	}
	attempt, err := i.service.GetAttemptInternal(ctx, req.GetAttemptId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoAttempt, err := toProtoAttempt(attempt)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &interviewv1.GetAttemptResponse{Attempt: protoAttempt}, nil
}

// ClaimOutboxEvents locks pending outbox rows for downstream consumers.
func (i *Implementation) ClaimOutboxEvents(
	ctx context.Context,
	req *interviewv1.ClaimOutboxEventsRequest,
) (*interviewv1.ClaimOutboxEventsResponse, error) {
	eventName := string(eventsadapter.AttemptSubmitted)
	if req.EventName != nil && req.GetEventName() != "" {
		eventName = req.GetEventName()
	}
	items, err := i.service.ClaimOutboxEvents(ctx, eventName, int(req.GetLimit()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*interviewv1.OutboxEvent, 0, len(items))
	for _, item := range items {
		payload, err := rawJSONToStruct(item.Payload)
		if err != nil {
			return nil, mapServiceError(err)
		}
		ev := &interviewv1.OutboxEvent{
			Id:         item.ID,
			EventName:  item.EventName,
			Payload:    payload,
			OccurredAt: timestamppb.New(item.CreatedAt),
		}
		if payload != nil {
			if ts, ok := payload.AsMap()["occurred_at"].(string); ok {
				if parsed, err := time.Parse(time.RFC3339Nano, ts); err == nil {
					ev.OccurredAt = timestamppb.New(parsed)
				}
			}
		}
		out = append(out, ev)
	}
	return &interviewv1.ClaimOutboxEventsResponse{Events: out}, nil
}

// AckOutboxEvents marks claimed outbox rows as published.
func (i *Implementation) AckOutboxEvents(
	ctx context.Context,
	req *interviewv1.AckOutboxEventsRequest,
) (*interviewv1.AckOutboxEventsResponse, error) {
	if err := i.service.AckOutboxEvents(ctx, req.GetEventIds()); err != nil {
		return nil, mapServiceError(err)
	}
	return &interviewv1.AckOutboxEventsResponse{}, nil
}

// FailOutboxEvent releases a claimed outbox row for retry.
func (i *Implementation) FailOutboxEvent(
	ctx context.Context,
	req *interviewv1.FailOutboxEventRequest,
) (*interviewv1.FailOutboxEventResponse, error) {
	if req.GetEventId() == "" {
		return nil, invalidArgument("event_id is required")
	}
	if err := i.service.FailOutboxEvent(ctx, req.GetEventId(), req.GetError()); err != nil {
		return nil, mapServiceError(err)
	}
	return &interviewv1.FailOutboxEventResponse{}, nil
}
