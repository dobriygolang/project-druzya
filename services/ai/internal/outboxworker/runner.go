package outboxworker

import (
	"context"
	"time"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/ops"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
)

// Poll claims outbox events and dispatches them to the handler.
func Poll(ctx context.Context, log logger.Logger, interview interviewadapter.Client, h *Handler, limit int) error {
	events, err := interview.ClaimOutboxEvents(ctx, AttemptSubmittedEvent, limit)
	if err != nil {
		return err
	}
	for _, ev := range events {
		start := time.Now()
		if !ev.OccurredAt.IsZero() {
			ops.ObserveOutboxLag("ai", AttemptSubmittedEvent, start.Sub(ev.OccurredAt))
		}
		attemptID, _ := ev.Payload["attempt_id"].(string)
		if err := h.HandleEvent(ctx, ev); err != nil {
			ops.IncOutboxEvent("ai", AttemptSubmittedEvent, "error")
			ops.ObserveOutboxDuration("ai", AttemptSubmittedEvent, time.Since(start))
			log.Error("outbox_failed",
				"event_id", ev.ID,
				"event_name", AttemptSubmittedEvent,
				"attempt_id", attemptID,
				"duration_ms", time.Since(start).Milliseconds(),
				"err", err,
			)
			continue
		}
		ops.IncOutboxEvent("ai", AttemptSubmittedEvent, "ok")
		ops.ObserveOutboxDuration("ai", AttemptSubmittedEvent, time.Since(start))
		log.Info("outbox_processed",
			"event_id", ev.ID,
			"event_name", AttemptSubmittedEvent,
			"attempt_id", attemptID,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	}
	return nil
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

	log.Info("outbox worker started", "interval", interval.String())

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
