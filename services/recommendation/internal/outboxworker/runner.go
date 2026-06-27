package outboxworker

import (
	"context"
	"time"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/logger"
)

// Poll claims recommendation-relevant outbox events in a single round-trip.
func Poll(ctx context.Context, log logger.Logger, interview interviewadapter.Client, h *Handler, limit int) error {
	events, err := interview.ClaimOutboxEvents(ctx, interviewadapter.OutboxClaimAll, limit)
	if err != nil {
		return err
	}
	for _, ev := range events {
		start := time.Now()
		if err := h.HandleEvent(ctx, ev); err != nil {
			log.Error("outbox_failed",
				"event_id", ev.ID,
				"event_name", ev.EventName,
				"duration_ms", time.Since(start).Milliseconds(),
				"err", err,
			)
			continue
		}
		log.Info("outbox_processed",
			"event_id", ev.ID,
			"event_name", ev.EventName,
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

	log.Info("outbox worker started", "interval", interval.String(), "claim", interviewadapter.OutboxClaimAll)

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
