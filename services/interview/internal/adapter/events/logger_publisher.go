package events

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/logger"
)

// LoggerPublisher logs events until databus/outbox is wired.
type LoggerPublisher struct {
	log logger.Logger
}

// NewLoggerPublisher constructs a structured-log event publisher.
func NewLoggerPublisher(log logger.Logger) *LoggerPublisher {
	return &LoggerPublisher{log: log}
}

// Publish writes event to structured logs.
func (p *LoggerPublisher) Publish(ctx context.Context, event Event) error {
	_ = ctx
	p.log.Info("domain event", "name", string(event.Name), "payload", event.Payload)
	return nil
}
