package outboxrelay

import (
	"context"
	"encoding/json"
	"time"

	natsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/nats"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/ops"
)

// Claimer claims and acknowledges domain outbox rows.
type Claimer interface {
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]interviewmodel.OutboxMessage, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id, errMsg string) error
}

// Publisher publishes claimed rows to the message bus.
type Publisher interface {
	Publish(msg interviewmodel.OutboxMessage) error
}

// Run polls domain_outbox and publishes to NATS until ctx is cancelled.
func Run(ctx context.Context, log logger.Logger, claimer Claimer, pub Publisher, interval time.Duration, batchSize int) error {
	if interval <= 0 {
		interval = 2 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 20
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Info("outbox relay started", "interval", interval.String(), "batch_size", batchSize)

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := relayOnce(ctx, log, claimer, pub, batchSize); err != nil {
				log.Error("outbox relay tick failed", "err", err)
			}
		}
	}
}

func relayOnce(ctx context.Context, log logger.Logger, claimer Claimer, pub Publisher, limit int) error {
	items, err := claimer.ClaimOutboxEvents(ctx, repository.OutboxClaimAll, limit)
	if err != nil {
		return err
	}
	for _, item := range items {
		start := time.Now()
		if err := pub.Publish(item); err != nil {
			ops.IncRelayPublish(item.EventName, "error")
			failErr := claimer.FailOutboxEvent(ctx, item.ID, err.Error())
			log.Error("outbox relay publish failed",
				"event_id", item.ID,
				"event_name", item.EventName,
				"fail_err", failErr,
				"err", err,
			)
			continue
		}
		if err := claimer.AckOutboxEvents(ctx, []string{item.ID}); err != nil {
			ops.IncRelayPublish(item.EventName, "error")
			log.Error("outbox relay ack failed", "event_id", item.ID, "err", err)
			continue
		}
		ops.IncRelayPublish(item.EventName, "ok")
		if !item.CreatedAt.IsZero() {
			ops.ObserveOutboxLag("relay", item.EventName, time.Since(item.CreatedAt))
		}
		log.Info("outbox relay published",
			"event_id", item.ID,
			"event_name", item.EventName,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	}
	return nil
}

// DecodeEnvelope parses a bus message into an outbox row shape for consumers.
func DecodeEnvelope(raw []byte) (interviewmodel.OutboxMessage, error) {
	var env natsadapter.Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return interviewmodel.OutboxMessage{}, err
	}
	return interviewmodel.OutboxMessage{
		ID:        env.EventID,
		EventName: env.EventName,
		Payload:   env.Payload,
		CreatedAt: env.OccurredAt,
	}, nil
}
