package outboxworker

import (
	"context"
	"time"

	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	recommendationservice "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/logger"
)

const (
	TrackerTaskCreatedEvent   = "tracker.task_created"
	TrackerTaskCompletedEvent = "tracker.task_completed"
)

var trackerEventNames = []string{
	TrackerTaskCreatedEvent,
	TrackerTaskCompletedEvent,
}

// TrackerHandler processes tracker outbox rows.
type TrackerHandler struct {
	Tracker trackeradapter.Client
	Service recommendationservice.Service
}

func (h *TrackerHandler) HandleEvent(ctx context.Context, ev trackeradapter.OutboxEvent) error {
	switch ev.EventName {
	case TrackerTaskCreatedEvent:
		if err := h.Service.HandleTrackerTaskCreated(ctx, ev.ID, ev.Payload); err != nil {
			return err
		}
	case TrackerTaskCompletedEvent:
		if err := h.Service.HandleTrackerTaskCompleted(ctx, ev.ID, ev.Payload); err != nil {
			return err
		}
	default:
		return nil
	}
	return h.Tracker.AckOutboxEvents(ctx, []string{ev.ID})
}

func PollTracker(ctx context.Context, log logger.Logger, tracker trackeradapter.Client, h *TrackerHandler, limit int) error {
	if tracker == nil {
		return nil
	}
	for _, eventName := range trackerEventNames {
		events, err := tracker.ClaimOutboxEvents(ctx, eventName, limit)
		if err != nil {
			return err
		}
		for _, ev := range events {
			if err := h.HandleEvent(ctx, ev); err != nil {
				log.Error("tracker outbox failed", "event_id", ev.ID, "err", err)
				_ = tracker.FailOutboxEvent(ctx, ev.ID, err.Error())
			}
		}
	}
	return nil
}

func RunTracker(ctx context.Context, log logger.Logger, tracker trackeradapter.Client, h *TrackerHandler, interval time.Duration, batchSize int) error {
	if tracker == nil {
		<-ctx.Done()
		return nil
	}
	if interval <= 0 {
		interval = 2 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 10
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	log.Info("tracker outbox worker started", "interval", interval.String())
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := PollTracker(ctx, log, tracker, h, batchSize); err != nil {
				log.Error("tracker outbox poll failed", "err", err)
			}
		}
	}
}
