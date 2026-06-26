package queue

import (
	"context"
)

// Message represents a job payload from the broker.
type Message struct {
	Topic   string
	Payload []byte
}

// Handler processes a single queue message.
type Handler func(ctx context.Context, msg Message) error

// Broker abstracts publish/subscribe over a message queue.
type Broker interface {
	Publish(ctx context.Context, topic string, payload []byte) error
	Subscribe(ctx context.Context, topic string, handler Handler) error
	Close() error
}

type noopBroker struct{}

// New returns a no-op broker stub until a real backend is wired.
func New(_ context.Context, _ string) (Broker, error) {
	return &noopBroker{}, nil
}

func (b *noopBroker) Publish(_ context.Context, _ string, _ []byte) error { return nil }

func (b *noopBroker) Subscribe(ctx context.Context, _ string, _ Handler) error {
	<-ctx.Done()
	return ctx.Err()
}

func (b *noopBroker) Close() error { return nil }
