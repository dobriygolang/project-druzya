package events

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Publisher emits billing domain events.
type Publisher interface {
	SubscriptionCreated(ctx context.Context, sub *model.Subscription) error
	SubscriptionUpdated(ctx context.Context, sub *model.Subscription) error
	SubscriptionCancelled(ctx context.Context, sub *model.Subscription) error
	UsageConsumed(ctx context.Context, userID, key string, used int) error
}

// NoopPublisher drops events.
type NoopPublisher struct{}

func (NoopPublisher) SubscriptionCreated(context.Context, *model.Subscription) error { return nil }
func (NoopPublisher) SubscriptionUpdated(context.Context, *model.Subscription) error { return nil }
func (NoopPublisher) SubscriptionCancelled(context.Context, *model.Subscription) error {
	return nil
}
func (NoopPublisher) UsageConsumed(context.Context, string, string, int) error { return nil }
