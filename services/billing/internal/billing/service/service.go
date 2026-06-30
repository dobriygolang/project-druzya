package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	identityadapter "github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/identity"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/cache"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/catalog"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/usecase/command/consume_usage"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/usecase/command/grant_subscription"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/usecase/command/release_usage"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/usecase/command/start_pro_trial"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/usecase/command/update_plan_entitlement"
)

var (
	ErrInvalidInput      = model.ErrInvalidInput
	ErrLimitExceeded     = repository.ErrLimitExceeded
	ErrNotFound          = repository.ErrNotFound
	ErrUnknownUser       = model.ErrUnknownUser
	ErrDuplicateEvent    = model.ErrDuplicateEvent
	ErrTrialAlreadyUsed  = model.ErrTrialAlreadyUsed
	ErrAlreadySubscribed = model.ErrAlreadySubscribed
	ErrTrialDisabled     = model.ErrTrialDisabled
)

// Service is billing domain logic.
type Service interface {
	GetCurrentPlan(ctx context.Context, userID string) (*model.Plan, error)
	GetEntitlements(ctx context.Context, userID string) (*model.EntitlementsView, error)
	ListPlans(ctx context.Context) ([]catalog.PlanCatalogItem, error)
	CheckEntitlement(ctx context.Context, userID, key string) (*model.CheckEntitlementResult, error)
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) (*model.ConsumeUsageResult, error)
	ReleaseUsage(ctx context.Context, userID, key, idempotencyKey string, amount int) (*model.ReleaseUsageResult, error)
	GrantSubscription(ctx context.Context, userID, planSlug string, periodEnd *time.Time) (*model.Subscription, error)
	StartProTrial(ctx context.Context, userID string) (*model.Subscription, error)
	UpdatePlanEntitlement(ctx context.Context, planSlug, key string, spec entitlement.Value) (entitlement.Value, error)
	RevokeSubscription(ctx context.Context, userID string) error
	HandleProviderWebhook(ctx context.Context, providerName string, headers map[string]string, body []byte) error
}

type billingService struct {
	repo         repository.Store
	identity     identityadapter.Client
	providers    map[string]providers.BillingProvider
	tierToPlan   map[string]string
	now          func() time.Time
	plansCache   *cache.Plans
	entitlements *cache.EntitlementsRedis
	proTrialEnabled bool
	proTrialDays    int

	// CQRS usecase handlers. Reads + webhook stay in the service; the two clear
	// write commands delegate here.
	consumeUsage      *consume_usage.Handler
	releaseUsage      *release_usage.Handler
	grantSubscription *grant_subscription.Handler
	startProTrial     *start_pro_trial.Handler
	updatePlanEntitlement *update_plan_entitlement.Handler
}

// Deps holds service dependencies.
type Deps struct {
	Repo               repository.Store
	Identity           identityadapter.Client
	Providers          []providers.BillingProvider
	TierToPlan         map[string]string
	PlansCache         *cache.Plans
	EntitlementsCache  *cache.EntitlementsRedis
	ProTrialEnabled    bool
	ProTrialDays       int
}

// New constructs billing service.
func New(deps Deps) Service {
	providerMap := make(map[string]providers.BillingProvider, len(deps.Providers))
	for _, p := range deps.Providers {
		if p != nil {
			providerMap[p.ProviderName()] = p
		}
	}
	svc := &billingService{
		repo:            deps.Repo,
		identity:        deps.Identity,
		providers:       providerMap,
		tierToPlan:      deps.TierToPlan,
		now:             time.Now,
		plansCache:      deps.PlansCache,
		entitlements:    deps.EntitlementsCache,
		proTrialEnabled: deps.ProTrialEnabled,
		proTrialDays:    deps.ProTrialDays,
	}
	svc.grantSubscription = grant_subscription.New(deps.Repo)
	svc.startProTrial = start_pro_trial.New(deps.Repo, deps.ProTrialDays)
	svc.updatePlanEntitlement = update_plan_entitlement.New(deps.Repo)
	svc.consumeUsage = consume_usage.New(deps.Repo, svc, svc)
	svc.releaseUsage = release_usage.New(deps.Repo, svc, svc)
	return svc
}

func (s *billingService) GetCurrentPlan(ctx context.Context, userID string) (*model.Plan, error) {
	plan, _, err := s.resolvePlan(ctx, userID)
	return plan, err
}

func (s *billingService) GetEntitlements(ctx context.Context, userID string) (*model.EntitlementsView, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}
	if s.entitlements != nil {
		if cached, ok, err := s.entitlements.Get(ctx, userID); err != nil {
			return nil, err
		} else if ok {
			return cached, nil
		}
	}
	view, err := s.buildEntitlements(ctx, userID)
	if err != nil {
		return nil, err
	}
	if s.entitlements != nil {
		_ = s.entitlements.Set(ctx, userID, view)
	}
	return view, nil
}

func (s *billingService) buildEntitlements(ctx context.Context, userID string) (*model.EntitlementsView, error) {
	plan, sub, err := s.resolvePlan(ctx, userID)
	if err != nil {
		return nil, err
	}
	items, err := s.ListPlanEntitlements(ctx, plan.ID)
	if err != nil {
		return nil, err
	}

	view := &model.EntitlementsView{
		UserID:   userID,
		PlanSlug: plan.Slug,
		PlanName: plan.Name,
		Features: map[string]bool{},
		Limits:   map[string]model.UsageLimitState{},
	}
	now := s.now().UTC()
	for _, item := range items {
		val, err := entitlement.Parse(item.ValueJSON)
		if err != nil {
			continue
		}
		switch val.Type {
		case entitlement.TypeBool:
			view.Features[item.Key] = val.Value
		case entitlement.TypeCounter:
			start, end, err := entitlement.PeriodWindow(val.Period, now)
			if err != nil {
				continue
			}
			used, err := s.repo.GetUsage(ctx, userID, item.Key, start, end)
			if err != nil {
				return nil, err
			}
			state := model.UsageLimitState{
				Key:         item.Key,
				Limit:       val.Limit,
				Used:        used,
				PeriodStart: start,
				PeriodEnd:   end,
				Unlimited:   val.Limit == nil,
			}
			state.Remaining = entitlement.Remaining(val.Limit, used)
			view.Limits[item.Key] = state
		case entitlement.TypeGauge:
			state := model.UsageLimitState{
				Key:       item.Key,
				Limit:     val.Limit,
				Unlimited: val.Limit == nil,
			}
			state.Remaining = entitlement.Remaining(val.Limit, 0)
			view.Limits[item.Key] = state
		}
	}
	s.applyTrialState(ctx, view, sub)
	return view, nil
}

func (s *billingService) applyTrialState(ctx context.Context, view *model.EntitlementsView, sub *model.Subscription) {
	if sub != nil && sub.Status == model.SubStatusTrialing {
		view.IsTrialing = true
		view.TrialEndsAt = sub.CurrentPeriodEnd
		return
	}
	if !s.proTrialEnabled || view.PlanSlug != model.PlanFree {
		return
	}
	used, err := s.repo.HasUsedProTrial(ctx, view.UserID)
	if err != nil || used {
		return
	}
	view.TrialAvailable = true
	view.TrialDays = s.proTrialDays
	if view.TrialDays <= 0 {
		view.TrialDays = 14
	}
}

// ListPlanEntitlements serves static plan entitlements from the in-memory snapshot when available.
func (s *billingService) ListPlanEntitlements(ctx context.Context, planID string) ([]model.PlanEntitlement, error) {
	if s.plansCache != nil {
		if items, err := s.plansCache.ListPlanEntitlements(planID); err == nil {
			return items, nil
		}
	}
	return s.repo.ListPlanEntitlements(ctx, planID)
}

func (s *billingService) ListPlans(ctx context.Context) ([]catalog.PlanCatalogItem, error) {
	if s.plansCache != nil {
		if items, err := s.plansCache.ListCatalog(); err == nil {
			return items, nil
		}
	}
	plans, err := s.repo.ListActivePlans(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]catalog.PlanCatalogItem, 0, len(plans))
	for _, plan := range plans {
		entitlements, err := s.repo.ListPlanEntitlements(ctx, plan.ID)
		if err != nil {
			return nil, err
		}
		item, err := catalog.BuildPlanCatalog(plan, entitlements)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, nil
}

func (s *billingService) CheckEntitlement(ctx context.Context, userID, key string) (*model.CheckEntitlementResult, error) {
	if userID == "" || key == "" {
		return nil, fmt.Errorf("user_id and key required: %w", ErrInvalidInput)
	}
	view, err := s.GetEntitlements(ctx, userID)
	if err != nil {
		return nil, err
	}
	if val, ok := view.Features[key]; ok {
		if !val {
			return &model.CheckEntitlementResult{Allowed: false, Value: false, Reason: "feature_disabled"}, nil
		}
		return &model.CheckEntitlementResult{Allowed: true, Value: true}, nil
	}
	return &model.CheckEntitlementResult{Allowed: false, Value: false, Reason: "unknown_entitlement"}, nil
}

// CheckAndConsumeUsage delegates to the consume_usage CQRS command handler.
func (s *billingService) CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) (*model.ConsumeUsageResult, error) {
	result, err := s.consumeUsage.Handle(ctx, consume_usage.Command{UserID: userID, Key: key, Amount: amount})
	if err == nil && s.entitlements != nil {
		s.entitlements.Invalidate(ctx, userID)
	}
	return result, err
}

// ReleaseUsage delegates to the release_usage CQRS command handler.
func (s *billingService) ReleaseUsage(ctx context.Context, userID, key, idempotencyKey string, amount int) (*model.ReleaseUsageResult, error) {
	result, err := s.releaseUsage.Handle(ctx, release_usage.Command{
		UserID:         userID,
		Key:            key,
		Amount:         amount,
		IdempotencyKey: idempotencyKey,
	})
	if err == nil && s.entitlements != nil {
		s.entitlements.Invalidate(ctx, userID)
	}
	return result, err
}

// GrantSubscription delegates to the grant_subscription CQRS command handler.
func (s *billingService) GrantSubscription(ctx context.Context, userID, planSlug string, periodEnd *time.Time) (*model.Subscription, error) {
	sub, err := s.grantSubscription.Handle(ctx, grant_subscription.Command{UserID: userID, PlanSlug: planSlug, PeriodEnd: periodEnd})
	if err == nil && s.entitlements != nil {
		s.entitlements.Invalidate(ctx, userID)
	}
	return sub, err
}

// StartProTrial grants a one-time internal Pro trial.
func (s *billingService) StartProTrial(ctx context.Context, userID string) (*model.Subscription, error) {
	if !s.proTrialEnabled {
		return nil, ErrTrialDisabled
	}
	sub, err := s.startProTrial.Handle(ctx, start_pro_trial.Command{UserID: userID})
	if err == nil && s.entitlements != nil {
		s.entitlements.Invalidate(ctx, userID)
	}
	return sub, err
}

// UpdatePlanEntitlement patches one plan entitlement and refreshes caches.
func (s *billingService) UpdatePlanEntitlement(ctx context.Context, planSlug, key string, spec entitlement.Value) (entitlement.Value, error) {
	out, err := s.updatePlanEntitlement.Handle(ctx, update_plan_entitlement.Command{
		PlanSlug: planSlug,
		Key:      key,
		Spec:     spec,
	})
	if err != nil {
		return entitlement.Value{}, err
	}
	if s.plansCache != nil {
		if reloadErr := s.plansCache.Reload(ctx); reloadErr != nil {
			return entitlement.Value{}, reloadErr
		}
	}
	if s.entitlements != nil {
		_ = s.entitlements.InvalidateAll(ctx)
	}
	return out, nil
}

// ResolvePlan satisfies consume_usage.PlanResolver, keeping plan-resolution
// rules shared with the read paths (GetEntitlements/GetCurrentPlan).
func (s *billingService) ResolvePlan(ctx context.Context, userID string) (*model.Plan, error) {
	plan, _, err := s.resolvePlan(ctx, userID)
	return plan, err
}

func (s *billingService) RevokeSubscription(ctx context.Context, userID string) error {
	if userID == "" {
		return fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}
	if err := s.repo.CancelActiveSubscriptions(ctx, userID); err != nil {
		return err
	}
	if s.entitlements != nil {
		s.entitlements.Invalidate(ctx, userID)
	}
	return nil
}

func (s *billingService) HandleProviderWebhook(ctx context.Context, providerName string, headers map[string]string, body []byte) error {
	provider, ok := s.providers[providerName]
	if !ok {
		return fmt.Errorf("unknown provider %q", providerName)
	}
	if err := provider.VerifyWebhook(ctx, headers, body); err != nil {
		return err
	}
	event, err := provider.ParseWebhook(ctx, headers, body)
	if err != nil {
		return err
	}

	// Resolve the user before opening the transaction: the identity lookup is a
	// read-only external call and must not hold a DB transaction open.
	if s.identity == nil {
		return fmt.Errorf("identity client not configured")
	}
	telegramID, err := parseTelegramID(event.ProviderUserID)
	if err != nil {
		return err
	}
	user, err := s.identity.GetUserByTelegramID(ctx, telegramID)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnknownUser, err)
	}

	// Mark-processed and apply run in one transaction. If apply fails, the
	// provider_events row is rolled back too, so redelivery can retry safely.
	return s.repo.WithTx(ctx, func(ctx context.Context) error {
		first, err := s.repo.MarkProviderEventProcessed(ctx, event.Provider, event.ProviderEventID, event.EventType, event.RawPayload)
		if err != nil {
			return err
		}
		if !first {
			return ErrDuplicateEvent
		}
		return s.applyProviderEvent(ctx, user.ID, event)
	})
}

func (s *billingService) applyProviderEvent(ctx context.Context, userID string, event providers.Event) error {
	username := optionalString(event.ProviderUsername)
	if err := s.repo.UpsertProviderAccount(ctx, &model.ProviderAccount{
		ID:               uuid.NewString(),
		UserID:           userID,
		Provider:         event.Provider,
		ProviderUserID:   event.ProviderUserID,
		ProviderUsername: username,
		Metadata:         event.RawPayload,
	}); err != nil {
		return fmt.Errorf("upsert provider account: %w", err)
	}

	switch event.EventType {
	case providers.EventSubscriptionCreated, providers.EventSubscriptionRenewed, providers.EventPaymentSucceeded:
		return s.activateProviderSubscription(ctx, userID, event)
	case providers.EventSubscriptionCancelled, providers.EventSubscriptionExpired, providers.EventPaymentFailed:
		return s.cancelProviderSubscription(ctx, userID, event)
	default:
		return fmt.Errorf("unsupported event type %q", event.EventType)
	}
}

func (s *billingService) activateProviderSubscription(ctx context.Context, userID string, event providers.Event) error {
	planSlug, ok := s.tierToPlan[strings.ToLower(strings.TrimSpace(event.Tier))]
	if !ok || planSlug == "" {
		return fmt.Errorf("unknown tribute tier %q", event.Tier)
	}
	plan, err := s.getPlanBySlug(ctx, planSlug)
	if err != nil {
		return err
	}

	var existing *model.Subscription
	if event.ProviderSubscriptionID != "" {
		existing, _ = s.repo.FindSubscriptionByProviderRef(ctx, event.Provider, event.ProviderSubscriptionID)
	}

	sub := &model.Subscription{
		UserID:             userID,
		PlanID:             plan.ID,
		PlanSlug:           plan.Slug,
		Provider:           event.Provider,
		Status:             model.SubStatusActive,
		CurrentPeriodStart: event.CurrentPeriodStart,
		CurrentPeriodEnd:   event.CurrentPeriodEnd,
		Metadata:           event.RawPayload,
	}
	if event.ProviderSubscriptionID != "" {
		sub.ProviderSubscriptionID = &event.ProviderSubscriptionID
	}
	if existing != nil {
		sub.ID = existing.ID
		sub.CreatedAt = existing.CreatedAt
	} else {
		sub.ID = uuid.NewString()
		if err := s.repo.CancelActiveSubscriptions(ctx, userID); err != nil {
			return err
		}
	}
	if err := s.repo.UpsertSubscription(ctx, sub); err != nil {
		return err
	}
	if s.entitlements != nil {
		s.entitlements.Invalidate(ctx, userID)
	}
	return nil
}

func (s *billingService) cancelProviderSubscription(ctx context.Context, userID string, event providers.Event) error {
	if event.ProviderSubscriptionID != "" {
		existing, err := s.repo.FindSubscriptionByProviderRef(ctx, event.Provider, event.ProviderSubscriptionID)
		if err == nil {
			existing.Status = model.SubStatusCancelled
			existing.Metadata = event.RawPayload
			if err := s.repo.UpsertSubscription(ctx, existing); err != nil {
				return err
			}
			return nil
		}
	}
	return s.RevokeSubscription(ctx, userID)
}

func (s *billingService) resolvePlan(ctx context.Context, userID string) (*model.Plan, *model.Subscription, error) {
	sub, err := s.repo.GetActiveSubscription(ctx, userID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, nil, err
	}
	if sub != nil {
		plan, err := s.getPlanByID(ctx, sub.PlanID)
		return plan, sub, err
	}
	plan, err := s.getPlanBySlug(ctx, model.PlanFree)
	return plan, nil, err
}

func (s *billingService) getPlanByID(ctx context.Context, id string) (*model.Plan, error) {
	if s.plansCache != nil {
		if plan, err := s.plansCache.GetPlanByID(id); err == nil {
			return plan, nil
		}
	}
	return s.repo.GetPlanByID(ctx, id)
}

func (s *billingService) getPlanBySlug(ctx context.Context, slug string) (*model.Plan, error) {
	if s.plansCache != nil {
		if plan, err := s.plansCache.GetPlanBySlug(slug); err == nil {
			return plan, nil
		}
	}
	return s.repo.GetPlanBySlug(ctx, slug)
}

func parseTelegramID(raw string) (int64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, fmt.Errorf("empty telegram id")
	}
	var id int64
	if _, err := fmt.Sscan(raw, &id); err != nil || id == 0 {
		return 0, fmt.Errorf("invalid telegram id %q", raw)
	}
	return id, nil
}

func optionalString(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

func IsLimitExceeded(err error) bool {
	return errors.Is(err, ErrLimitExceeded)
}
