package model

import (
	"encoding/json"
	"time"
)

// OutboxStatus is delivery state of a domain outbox row.
type OutboxStatus string

const (
	OutboxStatusPending    OutboxStatus = "pending"
	OutboxStatusProcessing OutboxStatus = "processing"
	OutboxStatusPublished  OutboxStatus = "published"
	OutboxStatusFailed     OutboxStatus = "failed"
)

// OutboxMessage is a durable domain event for downstream consumers.
type OutboxMessage struct {
	ID          string
	EventName   string
	Payload     json.RawMessage
	Status      OutboxStatus
	LockedUntil *time.Time
	RetryCount  int
	LastError   *string
	CreatedAt   time.Time
	ProcessedAt *time.Time
}
