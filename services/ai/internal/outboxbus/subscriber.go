package outboxbus

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
)

type envelope struct {
	EventID    string          `json:"event_id"`
	EventName  string          `json:"event_name"`
	OccurredAt time.Time       `json:"occurred_at"`
	Payload    json.RawMessage `json:"payload"`
}

// EventHandler processes a decoded outbox event from the bus.
type EventHandler interface {
	HandleBusEvent(ctx context.Context, ev interviewadapter.OutboxEvent) error
}

// Run subscribes to NATS subjects until ctx is cancelled.
func Run(ctx context.Context, log logger.Logger, natsURL, queueGroup string, subjects []string, h EventHandler) error {
	nc, err := nats.Connect(natsURL)
	if err != nil {
		return fmt.Errorf("nats connect: %w", err)
	}
	defer nc.Close()

	log.Info("outbox bus subscriber started", "subjects", subjects, "queue", queueGroup)

	for _, subject := range subjects {
		subject := subject
		_, subErr := nc.QueueSubscribe(subject, queueGroup, func(msg *nats.Msg) {
			var env envelope
			if err := json.Unmarshal(msg.Data, &env); err != nil {
				log.Error("outbox bus decode failed", "subject", subject, "err", err)
				return
			}
			payload := map[string]any{}
			if len(env.Payload) > 0 {
				_ = json.Unmarshal(env.Payload, &payload)
			}
			ev := interviewadapter.OutboxEvent{
				ID:         env.EventID,
				EventName:  env.EventName,
				Payload:    payload,
				OccurredAt: env.OccurredAt,
			}
			if err := h.HandleBusEvent(ctx, ev); err != nil {
				log.Error("outbox bus handler failed",
					"event_id", ev.ID,
					"event_name", ev.EventName,
					"err", err,
				)
			}
		})
		if subErr != nil {
			return fmt.Errorf("subscribe %s: %w", subject, subErr)
		}
	}

	<-ctx.Done()
	return nil
}
