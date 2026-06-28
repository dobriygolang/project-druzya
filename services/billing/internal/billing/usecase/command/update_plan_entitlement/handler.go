package update_plan_entitlement

import (
	"context"
	"encoding/json"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Store is the persistence port this command needs (consumer-side interface).
type Store interface {
	GetPlanBySlug(ctx context.Context, slug string) (*model.Plan, error)
	UpdatePlanEntitlement(ctx context.Context, planID, key string, valueJSON json.RawMessage) error
}

// Handler updates a plan entitlement definition.
type Handler struct {
	repo Store
}

// New constructs the update-plan-entitlement handler.
func New(repo Store) *Handler {
	return &Handler{repo: repo}
}

// Handle executes the command.
func (h *Handler) Handle(ctx context.Context, cmd Command) (entitlement.Value, error) {
	if err := cmd.Validate(); err != nil {
		return entitlement.Value{}, err
	}
	raw, err := entitlement.MarshalJSON(cmd.Spec)
	if err != nil {
		return entitlement.Value{}, err
	}
	plan, err := h.repo.GetPlanBySlug(ctx, cmd.PlanSlug)
	if err != nil {
		return entitlement.Value{}, err
	}
	if err := h.repo.UpdatePlanEntitlement(ctx, plan.ID, cmd.Key, raw); err != nil {
		return entitlement.Value{}, err
	}
	out, err := entitlement.Parse(raw)
	if err != nil {
		return entitlement.Value{}, err
	}
	return out, nil
}
