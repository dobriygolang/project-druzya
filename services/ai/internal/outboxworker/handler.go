package outboxworker

import (
	"context"
	"fmt"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/correlation"
)

const AttemptSubmittedEvent = "interview.attempt_submitted"

// Handler processes claimed outbox rows.
type Handler struct {
	Interview interviewadapter.Client
	Service   evaluationservice.Service
}

// HandleEvent parses payload, runs evaluation, then acks or fails the outbox row.
func (h *Handler) HandleEvent(ctx context.Context, ev interviewadapter.OutboxEvent) error {
	event, err := ParseAttemptSubmittedEvent(ev.Payload)
	if err != nil {
		failErr := h.Interview.FailOutboxEvent(ctx, ev.ID, err.Error())
		return fmt.Errorf("parse payload: %w; fail=%v", err, failErr)
	}
	ctx = correlation.WithAttemptID(ctx, event.AttemptID)
	if err := h.Service.HandleAttemptSubmitted(ctx, event); err != nil {
		failErr := h.Interview.FailOutboxEvent(ctx, ev.ID, err.Error())
		return fmt.Errorf("handle attempt submitted: %w; fail=%v", err, failErr)
	}
	return h.Interview.AckOutboxEvents(ctx, []string{ev.ID})
}

// ParseAttemptSubmittedEvent decodes interview outbox payload.
func ParseAttemptSubmittedEvent(payload map[string]any) (evaluationmodel.AttemptSubmittedEvent, error) {
	event := evaluationmodel.AttemptSubmittedEvent{
		AttemptID:     stringField(payload, "attempt_id"),
		UserID:        stringField(payload, "user_id"),
		TaskID:        stringField(payload, "task_id"),
		SessionID:     stringField(payload, "session_id"),
		SessionTaskID: stringField(payload, "session_task_id"),
	}
	if event.AttemptID == "" {
		return event, fmt.Errorf("attempt_id missing in payload")
	}
	return event, nil
}

func stringField(payload map[string]any, key string) string {
	v, ok := payload[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprintf("%v", t)
	}
}
