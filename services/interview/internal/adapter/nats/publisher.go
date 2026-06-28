package natsadapter

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// Envelope is the wire format for outbox relay messages.
type Envelope struct {
	EventID    string          `json:"event_id"`
	EventName  string          `json:"event_name"`
	OccurredAt time.Time       `json:"occurred_at"`
	Payload    json.RawMessage `json:"payload"`
}

// Publisher publishes outbox envelopes to NATS subjects (subject = event_name).
type Publisher struct {
	conn *nats.Conn
}

// Connect dials NATS and returns a Publisher.
func Connect(url string) (*Publisher, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}
	return &Publisher{conn: nc}, nil
}

// Close closes the NATS connection.
func (p *Publisher) Close() {
	if p != nil && p.conn != nil {
		p.conn.Close()
	}
}

// Publish sends one outbox message; subject equals event_name.
func (p *Publisher) Publish(msg interviewmodel.OutboxMessage) error {
	env := Envelope{
		EventID:    msg.ID,
		EventName:  msg.EventName,
		OccurredAt: msg.CreatedAt,
		Payload:    msg.Payload,
	}
	raw, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}
	if err := p.conn.Publish(msg.EventName, raw); err != nil {
		return fmt.Errorf("nats publish %s: %w", msg.EventName, err)
	}
	return nil
}
