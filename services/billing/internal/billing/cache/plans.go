package cache

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/catalog"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
)

// PlansSource loads plan catalog rows from Postgres.
type PlansSource interface {
	ListActivePlans(ctx context.Context) ([]model.Plan, error)
	ListPlanEntitlements(ctx context.Context, planID string) ([]model.PlanEntitlement, error)
}

type plansSnapshot struct {
	byID           map[string]model.Plan
	bySlug         map[string]model.Plan
	entitlements   map[string][]model.PlanEntitlement
	catalog        []catalog.PlanCatalogItem
	estimatedBytes int64
}

// Plans holds the in-memory plan catalog snapshot.
type Plans struct {
	ptr atomic.Pointer[plansSnapshot]
	src PlansSource
}

// NewPlans constructs a plan cache backed by repo reads.
func NewPlans(src PlansSource) *Plans {
	return &Plans{src: src}
}

// Reload rebuilds the plan snapshot from Postgres.
func (p *Plans) Reload(ctx context.Context) error {
	if p == nil || p.src == nil {
		return nil
	}
	start := time.Now()
	plans, err := p.src.ListActivePlans(ctx)
	if err != nil {
		IncPlansReload("error")
		return fmt.Errorf("list active plans: %w", err)
	}
	snap := &plansSnapshot{
		byID:         make(map[string]model.Plan, len(plans)),
		bySlug:       make(map[string]model.Plan, len(plans)),
		entitlements: make(map[string][]model.PlanEntitlement, len(plans)),
		catalog:      make([]catalog.PlanCatalogItem, 0, len(plans)),
	}
	for _, plan := range plans {
		snap.byID[plan.ID] = plan
		snap.bySlug[plan.Slug] = plan
		items, err := p.src.ListPlanEntitlements(ctx, plan.ID)
		if err != nil {
			IncPlansReload("error")
			return fmt.Errorf("list entitlements plan=%s: %w", plan.ID, err)
		}
		snap.entitlements[plan.ID] = items
		item, err := catalog.BuildPlanCatalog(plan, items)
		if err != nil {
			IncPlansReload("error")
			return fmt.Errorf("build plan catalog %s: %w", plan.Slug, err)
		}
		snap.catalog = append(snap.catalog, item)
	}
	snap.estimatedBytes = int64(len(plans)*256 + len(snap.catalog)*512)
	p.ptr.Store(snap)
	SetPlansSnapshotBytes(snap.estimatedBytes)
	ObservePlansReloadDuration(time.Since(start))
	IncPlansReload("ok")
	IncPlansHit()
	return nil
}

func (p *Plans) snapshot() *plansSnapshot {
	if p == nil {
		return nil
	}
	return p.ptr.Load()
}

// GetPlanByID returns a plan from the snapshot.
func (p *Plans) GetPlanByID(id string) (*model.Plan, error) {
	snap := p.snapshot()
	if snap == nil {
		IncPlansMiss()
		return nil, repository.ErrNotFound
	}
	plan, ok := snap.byID[id]
	if !ok {
		IncPlansHit()
		return nil, repository.ErrNotFound
	}
	IncPlansHit()
	copyPlan := plan
	return &copyPlan, nil
}

// GetPlanBySlug returns a plan from the snapshot.
func (p *Plans) GetPlanBySlug(slug string) (*model.Plan, error) {
	snap := p.snapshot()
	if snap == nil {
		IncPlansMiss()
		return nil, repository.ErrNotFound
	}
	plan, ok := snap.bySlug[slug]
	if !ok {
		IncPlansHit()
		return nil, repository.ErrNotFound
	}
	IncPlansHit()
	copyPlan := plan
	return &copyPlan, nil
}

// ListPlanEntitlements returns entitlements for a plan from the snapshot.
func (p *Plans) ListPlanEntitlements(planID string) ([]model.PlanEntitlement, error) {
	snap := p.snapshot()
	if snap == nil {
		IncPlansMiss()
		return nil, repository.ErrNotFound
	}
	items, ok := snap.entitlements[planID]
	if !ok {
		IncPlansHit()
		return nil, repository.ErrNotFound
	}
	IncPlansHit()
	return append([]model.PlanEntitlement(nil), items...), nil
}

// ListCatalog returns prebuilt public plan cards.
func (p *Plans) ListCatalog() ([]catalog.PlanCatalogItem, error) {
	snap := p.snapshot()
	if snap == nil {
		IncPlansMiss()
		return nil, repository.ErrNotFound
	}
	IncPlansHit()
	return append([]catalog.PlanCatalogItem(nil), snap.catalog...), nil
}
