package outboxworker

import (
	"context"
	"time"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/ops"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/logger"
)

// handledEventNames — only these types may be claimed. Do not use OutboxClaimAll:
// ai-service owns interview.attempt_submitted and a wildcard claim races with it.
var handledEventNames = []string{
	AttemptEvaluatedEvent,
	SessionCompletedEvent,
	RetryItemCreatedEvent,
}

// Poll claims recommendation-relevant outbox events (one claim per event type).
func Poll(ctx context.Context, log logger.Logger, interview interviewadapter.Client, h *Handler, limit int) error {
	for _, eventName := range handledEventNames {
		events, err := interview.ClaimOutboxEvents(ctx, eventName, limit)
		if err != nil {
			return err
		}
		for _, ev := range events {
			processOutboxEvent(ctx, log, h, ev)
		}
	}
	return nil
}

func processOutboxEvent(ctx context.Context, log logger.Logger, h *Handler, ev interviewadapter.OutboxEvent) {
	start := time.Now()
	if err := h.HandleEvent(ctx, ev); err != nil {
		ops.IncOutboxEvent("recommendation", ev.EventName, "error")
		ops.ObserveOutboxDuration("recommendation", ev.EventName, time.Since(start))
		log.Error("outbox_failed",
			"event_id", ev.ID,
			"event_name", ev.EventName,
			"duration_ms", time.Since(start).Milliseconds(),
			"err", err,
		)
		return
	}
	ops.IncOutboxEvent("recommendation", ev.EventName, "ok")
	ops.ObserveOutboxDuration("recommendation", ev.EventName, time.Since(start))
	log.Info("outbox_processed",
		"event_id", ev.ID,
		"event_name", ev.EventName,
		"duration_ms", time.Since(start).Milliseconds(),
	)
}

// Run polls interview outbox until ctx is cancelled.
func Run(ctx context.Context, log logger.Logger, interview interviewadapter.Client, h *Handler, interval time.Duration, batchSize int) error {
	if interval <= 0 {
		interval = 2 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 10
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Info("outbox worker started", "interval", interval.String(), "claim", handledEventNames)

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := Poll(ctx, log, interview, h, batchSize); err != nil {
				log.Error("outbox poll failed", "err", err)
			}
		}
	}
}
