package start_pro_trial

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
)

// Store is the persistence port this command needs (consumer-side interface).
type Store interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	GetPlanBySlug(ctx context.Context, slug string) (*model.Plan, error)
	GetActiveSubscription(ctx context.Context, userID string) (*model.Subscription, error)
	HasUsedProTrial(ctx context.Context, userID string) (bool, error)
	CancelActiveSubscriptions(ctx context.Context, userID string) error
	UpsertSubscription(ctx context.Context, sub *model.Subscription) error
}

// Handler starts a one-time Pro trial subscription.
type Handler struct {
	repo      Store
	trialDays int
}

// New constructs the start-pro-trial handler.
func New(repo Store, trialDays int) *Handler {
	if trialDays <= 0 {
		trialDays = 14
	}
	return &Handler{repo: repo, trialDays: trialDays}
}

// Handle executes the command.
func (h *Handler) Handle(ctx context.Context, cmd Command) (*model.Subscription, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}

	if sub, err := h.repo.GetActiveSubscription(ctx, cmd.UserID); err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	} else if sub != nil {
		return nil, fmt.Errorf("active subscription %q: %w", sub.PlanSlug, model.ErrAlreadySubscribed)
	}

	used, err := h.repo.HasUsedProTrial(ctx, cmd.UserID)
	if err != nil {
		return nil, err
	}
	if used {
		return nil, model.ErrTrialAlreadyUsed
	}

	plan, err := h.repo.GetPlanBySlug(ctx, model.PlanProMonthly)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	end := now.Add(time.Duration(h.trialDays) * 24 * time.Hour)
	meta, err := json.Marshal(map[string]string{"kind": model.TrialKindPro})
	if err != nil {
		return nil, fmt.Errorf("marshal trial metadata: %w", err)
	}

	sub := &model.Subscription{
		ID:                 uuid.NewString(),
		UserID:             cmd.UserID,
		PlanID:             plan.ID,
		PlanSlug:           plan.Slug,
		Provider:           model.ProviderInternal,
		Status:             model.SubStatusTrialing,
		CurrentPeriodStart: &now,
		CurrentPeriodEnd:   &end,
		Metadata:           meta,
	}

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
