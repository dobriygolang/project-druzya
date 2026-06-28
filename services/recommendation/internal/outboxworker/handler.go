package outboxworker

import (
	"context"
	"fmt"
	"strconv"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	recommendationservice "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/payload"
)

const (
	AttemptEvaluatedEvent = "interview.attempt_evaluated"
	SessionCompletedEvent = "interview.session_completed"
	RetryItemCreatedEvent = "interview.retry_item_created"
	TaskSkippedEvent      = "interview.task_skipped"
)

// Handler processes claimed outbox rows.
type Handler struct {
	Interview interviewadapter.Client
	Service   recommendationservice.Service
	fromBus   bool
}

// HandleBusEvent handles an event delivered via NATS (relay already acked outbox).
func (h *Handler) HandleBusEvent(ctx context.Context, ev interviewadapter.OutboxEvent) error {
	h.fromBus = true
	defer func() { h.fromBus = false }()
	return h.HandleEvent(ctx, ev)
}

// HandleEvent routes a claimed outbox row to the appropriate domain handler.
func (h *Handler) HandleEvent(ctx context.Context, ev interviewadapter.OutboxEvent) error {
	switch ev.EventName {
	case AttemptEvaluatedEvent:
		event, err := ParseAttemptEvaluatedEvent(ev.Payload)
		if err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("parse attempt_evaluated: %w", err))
		}
		if err := h.Service.HandleAttemptEvaluated(ctx, ev.ID, event); err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("handle attempt evaluated: %w", err))
		}
	case SessionCompletedEvent:
		event, err := ParseSessionCompletedEvent(ev.Payload)
		if err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("parse session_completed: %w", err))
		}
		if err := h.Service.HandleSessionCompleted(ctx, ev.ID, event); err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("handle session completed: %w", err))
		}
	case RetryItemCreatedEvent:
		event, err := ParseRetryItemCreatedEvent(ev.Payload)
		if err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("parse retry_item_created: %w", err))
		}
		if err := h.Service.HandleRetryItemCreated(ctx, ev.ID, event); err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("handle retry item created: %w", err))
		}
	case TaskSkippedEvent:
		event, err := ParseTaskSkippedEvent(ev.Payload)
		if err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("parse task_skipped: %w", err))
		}
		if err := h.Service.HandleTaskSkipped(ctx, ev.ID, event); err != nil {
			return h.fail(ctx, ev.ID, fmt.Errorf("handle task skipped: %w", err))
		}
	default:
		return fmt.Errorf("unexpected event %q (not owned by recommendation)", ev.EventName)
	}
	if h.fromBus {
		return nil
	}
	return h.Interview.AckOutboxEvents(ctx, []string{ev.ID})
}

func (h *Handler) fail(ctx context.Context, eventID string, err error) error {
	if h.fromBus {
		return err
	}
	failErr := h.Interview.FailOutboxEvent(ctx, eventID, err.Error())
	return fmt.Errorf("%w; fail=%v", err, failErr)
}

// ParseAttemptEvaluatedEvent decodes interview outbox payload.
func ParseAttemptEvaluatedEvent(p map[string]any) (model.AttemptEvaluatedEvent, error) {
	event := model.AttemptEvaluatedEvent{
		AttemptID:  payload.StringField(p, "attempt_id"),
		UserID:     payload.StringField(p, "user_id"),
		TaskID:     payload.StringField(p, "task_id"),
		SessionID:  payload.StringField(p, "session_id"),
		TaskType:   payload.StringField(p, "task_type"),
		Mode:       payload.StringField(p, "mode"),
		Passed:     payload.BoolField(p, "passed"),
		Score:      payload.ParseScoreField(p),
		OccurredAt: payload.ParseOccurredAt(p),
	}
	if templateID := payload.StringField(p, "template_id"); templateID != "" {
		event.TemplateID = &templateID
	}
	if raw, ok := p["criteria"]; ok {
		if items, ok := raw.([]any); ok {
			event.Criteria = items
		}
	}
	if event.AttemptID == "" {
		return event, fmt.Errorf("attempt_id missing in payload")
	}
	if event.UserID == "" {
		return event, fmt.Errorf("user_id missing in payload")
	}
	return event, nil
}

// ParseSessionCompletedEvent decodes session_completed payload.
func ParseSessionCompletedEvent(p map[string]any) (model.SessionCompletedEvent, error) {
	event := model.SessionCompletedEvent{
		SessionID:  payload.StringField(p, "session_id"),
		UserID:     payload.StringField(p, "user_id"),
		Mode:       payload.StringField(p, "mode"),
		Outcome:    payload.StringField(p, "outcome"),
		TotalScore: payload.ParseScoreField(p),
		OccurredAt: payload.ParseOccurredAt(p),
	}
	if templateID := payload.StringField(p, "template_id"); templateID != "" {
		event.TemplateID = &templateID
	}
	if passingRaw := payload.StringField(p, "passing_score"); passingRaw != "" {
		if v, err := strconv.Atoi(passingRaw); err == nil {
			event.PassingScore = v
		}
	}
	if event.PassingScore == 0 {
		if v, ok := p["passing_score"].(float64); ok {
			event.PassingScore = int(v)
		}
	}
	if event.SessionID == "" {
		return event, fmt.Errorf("session_id missing in payload")
	}
	if event.UserID == "" {
		return event, fmt.Errorf("user_id missing in payload")
	}
	if totalRaw := payload.StringField(p, "total_score"); totalRaw != "" {
		if f, err := strconv.ParseFloat(totalRaw, 64); err == nil {
			event.TotalScore = f
		}
	}
	return event, nil
}

// ParseRetryItemCreatedEvent decodes retry_item_created payload.
func ParseRetryItemCreatedEvent(p map[string]any) (model.RetryItemCreatedEvent, error) {
	event := model.RetryItemCreatedEvent{
		RetryItemID: payload.StringField(p, "retry_item_id"),
		UserID:      payload.StringField(p, "user_id"),
		TaskID:      payload.StringField(p, "task_id"),
		AttemptID:   payload.StringField(p, "attempt_id"),
		OccurredAt:  payload.ParseOccurredAt(p),
	}
	if event.UserID == "" {
		return event, fmt.Errorf("user_id missing in payload")
	}
	if event.TaskID == "" {
		return event, fmt.Errorf("task_id missing in payload")
	}
	return event, nil
}

// ParseTaskSkippedEvent decodes task_skipped payload.
func ParseTaskSkippedEvent(p map[string]any) (model.TaskSkippedEvent, error) {
	event := model.TaskSkippedEvent{
		SessionTaskID: payload.StringField(p, "session_task_id"),
		SessionID:     payload.StringField(p, "session_id"),
		UserID:        payload.StringField(p, "user_id"),
		TaskID:        payload.StringField(p, "task_id"),
		Mode:          payload.StringField(p, "mode"),
		OccurredAt:    payload.ParseOccurredAt(p),
	}
	if event.UserID == "" {
		return event, fmt.Errorf("user_id missing in payload")
	}
	if event.TaskID == "" {
		return event, fmt.Errorf("task_id missing in payload")
	}
	return event, nil
}
