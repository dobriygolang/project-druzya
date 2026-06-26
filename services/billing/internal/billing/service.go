package billing

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/postgres"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/logger"
)

// Subscription represents a user's billing plan.
type Subscription struct {
	ID     string
	UserID string
	Plan   string
	Status string
}

// Service handles plans, subscriptions and payment webhooks.
type Service interface {
	GetSubscription(ctx context.Context, userID string) (*Subscription, error)
	HandleWebhook(ctx context.Context, payload []byte) error
}

type service struct {
	pg  *postgres.Pool
	log logger.Logger
}

// NewService constructs the billing domain service.
func NewService(pg *postgres.Pool, log logger.Logger) Service {
	return &service{pg: pg, log: log}
}

func (s *service) GetSubscription(_ context.Context, _ string) (*Subscription, error) {
	return nil, nil // TODO
}

func (s *service) HandleWebhook(_ context.Context, _ []byte) error {
	return nil // TODO
}
