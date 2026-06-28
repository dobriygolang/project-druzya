package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/events"
	identityadapter "github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/identity"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers/tribute"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
)

type fakeRepo struct {
	plan         *model.Plan
	sub          *model.Subscription
	entitlements []model.PlanEntitlement
	usage        map[string]int
	releaseDedup map[string]struct{}
	cancelCalled bool
	lastSub      *model.Subscription
}

func (f *fakeRepo) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

func (f *fakeRepo) GetPlanBySlug(_ context.Context, slug string) (*model.Plan, error) {
	if f.plan != nil && f.plan.Slug == slug {
		return f.plan, nil
	}
	return nil, repository.ErrNotFound
}

func (f *fakeRepo) GetPlanByID(_ context.Context, id string) (*model.Plan, error) {
	if f.plan != nil && f.plan.ID == id {
		return f.plan, nil
	}
	return nil, repository.ErrNotFound
}

func (f *fakeRepo) ListActivePlans(_ context.Context) ([]model.Plan, error) {
	if f.plan != nil {
		return []model.Plan{*f.plan}, nil
	}
	return nil, nil
}

func (f *fakeRepo) ListPlanEntitlements(context.Context, string) ([]model.PlanEntitlement, error) {
	return f.entitlements, nil
}

func (f *fakeRepo) GetActiveSubscription(context.Context, string) (*model.Subscription, error) {
	if f.sub != nil {
		return f.sub, nil
	}
	return nil, repository.ErrNotFound
}

func (f *fakeRepo) UpsertSubscription(_ context.Context, sub *model.Subscription) error {
	copy := *sub
	f.lastSub = &copy
	return nil
}

func (f *fakeRepo) CancelActiveSubscriptions(context.Context, string) error {
	f.cancelCalled = true
	return nil
}

func (f *fakeRepo) UpsertProviderAccount(context.Context, *model.ProviderAccount) error { return nil }
func (f *fakeRepo) GetProviderAccount(context.Context, string, string) (*model.ProviderAccount, error) {
	return nil, repository.ErrNotFound
}
func (f *fakeRepo) MarkProviderEventProcessed(context.Context, string, string, string, json.RawMessage) (bool, error) {
	return true, nil
}
func (f *fakeRepo) FindSubscriptionByProviderRef(context.Context, string, string) (*model.Subscription, error) {
	return nil, repository.ErrNotFound
}

func (f *fakeRepo) GetUsage(_ context.Context, _, key string, _, _ time.Time) (int, error) {
	if f.usage == nil {
		return 0, nil
	}
	return f.usage[key], nil
}

func (f *fakeRepo) ConsumeUsage(_ context.Context, _, key string, _, _ time.Time, amount, limit int) (int, error) {
	if f.usage == nil {
		f.usage = map[string]int{}
	}
	next := f.usage[key] + amount
	if next > limit {
		return f.usage[key], repository.ErrLimitExceeded
	}
	f.usage[key] = next
	return next, nil
}

func (f *fakeRepo) ConsumeUsageUnlimited(_ context.Context, _, key string, _, _ time.Time, amount int) (int, error) {
	if f.usage == nil {
		f.usage = map[string]int{}
	}
	f.usage[key] += amount
	return f.usage[key], nil
}

func (f *fakeRepo) ReleaseUsage(_ context.Context, _, key string, _, _ time.Time, amount int) (int, error) {
	if f.usage == nil {
		f.usage = map[string]int{}
	}
	f.usage[key] -= amount
	if f.usage[key] < 0 {
		f.usage[key] = 0
	}
	return f.usage[key], nil
}

func (f *fakeRepo) MarkUsageReleaseProcessed(_ context.Context, idempotencyKey, _, _ string, _ int) (bool, error) {
	if f.releaseDedup == nil {
		f.releaseDedup = map[string]struct{}{}
	}
	if _, ok := f.releaseDedup[idempotencyKey]; ok {
		return false, nil
	}
	f.releaseDedup[idempotencyKey] = struct{}{}
	return true, nil
}

func newTestService(repo *fakeRepo) Service {
	return New(Deps{Repo: repo, Events: events.NoopPublisher{}, TierToPlan: map[string]string{"tribute_pro_monthly": model.PlanProMonthly}})
}

func TestGetCurrentPlanDefaultsToFree(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{plan: &model.Plan{ID: "free-id", Slug: model.PlanFree, Name: "Free"}}
	plan, err := newTestService(repo).GetCurrentPlan(context.Background(), "user-1")
	if err != nil {
		t.Fatal(err)
	}
	if plan.Slug != model.PlanFree {
		t.Fatalf("expected free, got %s", plan.Slug)
	}
}

func TestGetCurrentPlanUsesActiveSubscription(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{
		plan: &model.Plan{ID: "pro-id", Slug: model.PlanProMonthly, Name: "Pro"},
		sub:  &model.Subscription{PlanID: "pro-id", Status: model.SubStatusActive},
	}
	plan, err := newTestService(repo).GetCurrentPlan(context.Background(), "user-1")
	if err != nil {
		t.Fatal(err)
	}
	if plan.Slug != model.PlanProMonthly {
		t.Fatalf("expected pro, got %s", plan.Slug)
	}
}

func TestCheckEntitlementBool(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{
		plan: &model.Plan{ID: "free-id", Slug: model.PlanFree, Name: "Free"},
		entitlements: []model.PlanEntitlement{
			{Key: model.EntitlementHiddenTestsEnabled, ValueJSON: json.RawMessage(`{"type":"bool","value":false}`)},
		},
	}
	res, err := newTestService(repo).CheckEntitlement(context.Background(), "user-1", model.EntitlementHiddenTestsEnabled)
	if err != nil {
		t.Fatal(err)
	}
	if res.Allowed {
		t.Fatal("expected disabled feature")
	}
}

func TestCheckAndConsumeUsageIncrements(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{
		plan:  &model.Plan{ID: "free-id", Slug: model.PlanFree, Name: "Free"},
		usage: map[string]int{},
		entitlements: []model.PlanEntitlement{
			{Key: model.EntitlementAIEvaluationsPerDay, ValueJSON: json.RawMessage(`{"type":"counter","limit":5,"period":"day"}`)},
		},
	}
	res, err := newTestService(repo).CheckAndConsumeUsage(context.Background(), "user-1", model.EntitlementAIEvaluationsPerDay, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Allowed || res.Used != 1 {
		t.Fatalf("unexpected: %+v", res)
	}
}

func TestCheckAndConsumeUsageRejectsOverLimit(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{
		plan:  &model.Plan{ID: "free-id", Slug: model.PlanFree, Name: "Free"},
		usage: map[string]int{model.EntitlementAIEvaluationsPerDay: 5},
		entitlements: []model.PlanEntitlement{
			{Key: model.EntitlementAIEvaluationsPerDay, ValueJSON: json.RawMessage(`{"type":"counter","limit":5,"period":"day"}`)},
		},
	}
	res, err := newTestService(repo).CheckAndConsumeUsage(context.Background(), "user-1", model.EntitlementAIEvaluationsPerDay, 1)
	if err != nil {
		t.Fatal(err)
	}
	if res.Allowed || res.Reason != "limit_exceeded" {
		t.Fatalf("unexpected: %+v", res)
	}
	if repo.usage[model.EntitlementAIEvaluationsPerDay] != 5 {
		t.Fatal("must not increment on failure")
	}
}

func TestReleaseUsageDecrementsConsumedQuota(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{
		plan:  &model.Plan{ID: "free-id", Slug: model.PlanFree, Name: "Free"},
		usage: map[string]int{model.EntitlementAIEvaluationsPerDay: 3},
		entitlements: []model.PlanEntitlement{
			{Key: model.EntitlementAIEvaluationsPerDay, ValueJSON: json.RawMessage(`{"type":"counter","limit":5,"period":"day"}`)},
		},
	}
	svc := newTestService(repo)
	res, err := svc.ReleaseUsage(context.Background(), "user-1", model.EntitlementAIEvaluationsPerDay, "attempt-1", 1)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Released || res.Used != 2 {
		t.Fatalf("unexpected: %+v", res)
	}
	res2, err := svc.ReleaseUsage(context.Background(), "user-1", model.EntitlementAIEvaluationsPerDay, "attempt-1", 1)
	if err != nil {
		t.Fatal(err)
	}
	if !res2.Released || res2.Reason != "already_released" || repo.usage[model.EntitlementAIEvaluationsPerDay] != 2 {
		t.Fatalf("unexpected duplicate release: %+v usage=%d", res2, repo.usage[model.EntitlementAIEvaluationsPerDay])
	}
}

func TestGrantSubscriptionCreatesActiveSub(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{plan: &model.Plan{ID: "pro-id", Slug: model.PlanProMonthly, Name: "Pro"}}
	sub, err := newTestService(repo).GrantSubscription(context.Background(), "user-1", model.PlanProMonthly, nil)
	if err != nil {
		t.Fatal(err)
	}
	if sub.Status != model.SubStatusActive || !repo.cancelCalled {
		t.Fatalf("unexpected sub: %+v cancel=%v", sub, repo.cancelCalled)
	}
}

func TestTributeWebhookCreatesSubscription(t *testing.T) {
	t.Parallel()
	repo := &fakeRepo{
		plan: &model.Plan{ID: "pro-id", Slug: model.PlanProMonthly, Name: "Pro"},
	}
	identity := &fakeIdentity{user: &identityadapter.User{ID: "user-1", Username: "tester"}}
	provider := tribute.New(tribute.Config{WebhookSecret: "test-secret"})
	svc := New(Deps{
		Repo:       repo,
		Identity:   identity,
		Providers:  []providers.BillingProvider{provider},
		TierToPlan: map[string]string{"tribute_pro_monthly": model.PlanProMonthly},
		Events:     events.NoopPublisher{},
	})
	body := []byte(`{
		"event_id":"evt-1",
		"event_type":"subscription_created",
		"telegram_user_id":12345,
		"username":"tester",
		"subscription_id":"sub-1",
		"tier":"tribute_pro_monthly",
		"status":"active"
	}`)
	headers := map[string]string{"X-Tribute-Secret": "test-secret"}
	if err := svc.HandleProviderWebhook(context.Background(), "tribute", headers, body); err != nil {
		t.Fatal(err)
	}
	if repo.lastSub == nil || repo.lastSub.PlanSlug != model.PlanProMonthly {
		t.Fatalf("expected pro subscription, got %+v", repo.lastSub)
	}
}

type fakeIdentity struct {
	user *identityadapter.User
}

func (f *fakeIdentity) GetUser(context.Context, string) (*identityadapter.User, error) {
	return f.user, nil
}

func (f *fakeIdentity) GetUserByTelegramID(context.Context, int64) (*identityadapter.User, error) {
	if f.user == nil {
		return nil, errors.New("not found")
	}
	return f.user, nil
}

var _ repository.Store = (*fakeRepo)(nil)
