package release_usage

import (
	"context"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
)

// Store is the persistence port this command needs.
type Store interface {
	GetUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time) (int, error)
	ReleaseUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount int) (int, error)
	MarkUsageReleaseProcessed(ctx context.Context, idempotencyKey, userID, key string, amount int) (bool, error)
}

// PlanEntitlements lists static entitlements for a plan.
type PlanEntitlements interface {
	ListPlanEntitlements(ctx context.Context, planID string) ([]model.PlanEntitlement, error)
}

// PlanResolver resolves a user's effective plan.
type PlanResolver interface {
	ResolvePlan(ctx context.Context, userID string) (*model.Plan, error)
}

// Handler releases consumed usage quota.
type Handler struct {
	repo  Store
	plans PlanResolver
	ents  PlanEntitlements
	now   func() time.Time
}

// New constructs the release-usage handler.
func New(repo Store, plans PlanResolver, ents PlanEntitlements) *Handler {
	return &Handler{repo: repo, plans: plans, ents: ents, now: time.Now}
}

// Handle executes the command.
func (h *Handler) Handle(ctx context.Context, cmd Command) (*model.ReleaseUsageResult, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}
	key := normalizeUsageKey(cmd.Key)

	claimed, err := h.repo.MarkUsageReleaseProcessed(ctx, cmd.IdempotencyKey, cmd.UserID, key, cmd.Amount)
	if err != nil {
		return nil, err
	}
	if !claimed {
		used, err := h.currentUsed(ctx, cmd.UserID, key)
		if err != nil {
			return nil, err
		}
		return &model.ReleaseUsageResult{Released: true, Used: used, Reason: "already_released"}, nil
	}

	plan, err := h.plans.ResolvePlan(ctx, cmd.UserID)
	if err != nil {
		return nil, err
	}
	ent, err := h.findEntitlement(ctx, plan.ID, key)
	if err != nil {
		return nil, err
	}
	val, err := entitlement.Parse(ent.ValueJSON)
	if err != nil {
		return nil, err
	}
	if val.Type != entitlement.TypeCounter {
		return &model.ReleaseUsageResult{Released: false, Reason: "not_a_usage_entitlement"}, nil
	}
	start, end, err := entitlement.PeriodWindow(val.Period, h.now())
	if err != nil {
		return nil, err
	}

	used, err := h.repo.ReleaseUsage(ctx, cmd.UserID, key, start, end, cmd.Amount)
	if err != nil {
		return nil, err
	}
	result := &model.ReleaseUsageResult{
		Released: true,
		Used:     used,
		Limit:    val.Limit,
	}
	result.Remaining = entitlement.Remaining(val.Limit, used)
	return result, nil
}

func (h *Handler) currentUsed(ctx context.Context, userID, key string) (int, error) {
	plan, err := h.plans.ResolvePlan(ctx, userID)
	if err != nil {
		return 0, err
	}
	ent, err := h.findEntitlement(ctx, plan.ID, key)
	if err != nil {
		return 0, err
	}
	val, err := entitlement.Parse(ent.ValueJSON)
	if err != nil {
		return 0, err
	}
	if val.Type != entitlement.TypeCounter {
		return 0, nil
	}
	start, end, err := entitlement.PeriodWindow(val.Period, h.now())
	if err != nil {
		return 0, err
	}
	return h.repo.GetUsage(ctx, userID, key, start, end)
}

func (h *Handler) findEntitlement(ctx context.Context, planID, key string) (*model.PlanEntitlement, error) {
	items, err := h.ents.ListPlanEntitlements(ctx, planID)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].Key == key {
			return &items[i], nil
		}
	}
	return nil, repository.ErrNotFound
}

func normalizeUsageKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "llm_evaluation" {
		return "ai_evaluations_per_day"
	}
	return key
}
