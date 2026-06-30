package grant_subscription

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Store is the persistence port this command needs (consumer-side interface).
type Store interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	GetPlanBySlug(ctx context.Context, slug string) (*model.Plan, error)
	CancelActiveSubscriptions(ctx context.Context, userID string) error
	UpsertSubscription(ctx context.Context, sub *model.Subscription) error
}

// Handler grants an internal subscription.
type Handler struct {
	repo Store
}

// New constructs the grant-subscription handler.
func New(repo Store) *Handler {
	return &Handler{repo: repo}
}

// Handle executes the command.
func (h *Handler) Handle(ctx context.Context, cmd Command) (*model.Subscription, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}

	plan, err := h.repo.GetPlanBySlug(ctx, cmd.PlanSlug)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	sub := &model.Subscription{
		ID:                 uuid.NewString(),
		UserID:             cmd.UserID,
		PlanID:             plan.ID,
		PlanSlug:           plan.Slug,
		Provider:           model.ProviderInternal,
		Status:             model.SubStatusActive,
		CurrentPeriodStart: &now,
		CurrentPeriodEnd:   cmd.PeriodEnd,
		Metadata:           json.RawMessage(`{}`),
	}
	// Cancel previous subscriptions and create the new one atomically so a
	// failure between the two cannot leave the user without any subscription.
	if err := h.repo.WithTx(ctx, func(ctx context.Context) error {
		if err := h.repo.CancelActiveSubscriptions(ctx, cmd.UserID); err != nil {
			return err
		}
		return h.repo.UpsertSubscription(ctx, sub)
	}); err != nil {
		return nil, err
	}
	return sub, nil
}
