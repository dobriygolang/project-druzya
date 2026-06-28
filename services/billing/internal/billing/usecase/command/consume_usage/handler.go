package consume_usage

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
)

// Store is the persistence port this command needs.
type Store interface {
	GetUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time) (int, error)
	ConsumeUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount, limit int) (int, error)
	ConsumeUsageUnlimited(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount int) (int, error)
}

// PlanEntitlements lists static entitlements for a plan.
type PlanEntitlements interface {
	ListPlanEntitlements(ctx context.Context, planID string) ([]model.PlanEntitlement, error)
}

// PlanResolver resolves a user's effective plan. Implemented by the billing
// service so plan-resolution rules stay shared with the read paths.
type PlanResolver interface {
	ResolvePlan(ctx context.Context, userID string) (*model.Plan, error)
}

// EventPublisher emits the usage-consumed event.
type EventPublisher interface {
	UsageConsumed(ctx context.Context, userID, key string, used int) error
}

// Handler checks and consumes a usage quota.
type Handler struct {
	repo   Store
	plans  PlanResolver
	ents   PlanEntitlements
	events EventPublisher
	now    func() time.Time
}

// New constructs the consume-usage handler.
func New(repo Store, plans PlanResolver, ents PlanEntitlements, events EventPublisher) *Handler {
	return &Handler{repo: repo, plans: plans, ents: ents, events: events, now: time.Now}
}

// Handle executes the command.
func (h *Handler) Handle(ctx context.Context, cmd Command) (*model.ConsumeUsageResult, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}
	key := normalizeUsageKey(cmd.Key)

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
		return &model.ConsumeUsageResult{Allowed: false, Reason: "not_a_usage_entitlement"}, nil
	}
	start, end, err := entitlement.PeriodWindow(val.Period, h.now())
	if err != nil {
		return nil, err
	}

	if val.Limit == nil {
		used, err := h.repo.ConsumeUsageUnlimited(ctx, cmd.UserID, key, start, end, cmd.Amount)
		if err != nil {
			return nil, err
		}
		_ = h.events.UsageConsumed(ctx, cmd.UserID, key, used)
		return &model.ConsumeUsageResult{Allowed: true, Used: used}, nil
	}

	used, err := h.repo.ConsumeUsage(ctx, cmd.UserID, key, start, end, cmd.Amount, *val.Limit)
	if errors.Is(err, repository.ErrLimitExceeded) {
		current, _ := h.repo.GetUsage(ctx, cmd.UserID, key, start, end)
		return &model.ConsumeUsageResult{
			Allowed:   false,
			Used:      current,
			Remaining: entitlement.Remaining(val.Limit, current),
			Limit:     val.Limit,
			Reason:    "limit_exceeded",
		}, nil
	}
	if err != nil {
		return nil, err
	}
	_ = h.events.UsageConsumed(ctx, cmd.UserID, key, used)
	return &model.ConsumeUsageResult{
		Allowed:   true,
		Used:      used,
		Remaining: entitlement.Remaining(val.Limit, used),
		Limit:     val.Limit,
	}, nil
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
		return model.EntitlementAIEvaluationsPerDay
	}
	return key
}
