package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/events"
	identityadapter "github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/identity"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/usecase/command/consume_usage"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/usecase/command/grant_subscription"
)

var (
	ErrInvalidInput   = model.ErrInvalidInput
	ErrLimitExceeded  = repository.ErrLimitExceeded
	ErrNotFound       = repository.ErrNotFound
	ErrUnknownUser    = model.ErrUnknownUser
	ErrDuplicateEvent = model.ErrDuplicateEvent
)

// Service is billing domain logic.
type Service interface {
	GetCurrentPlan(ctx context.Context, userID string) (*model.Plan, error)
	GetEntitlements(ctx context.Context, userID string) (*model.EntitlementsView, error)
	CheckEntitlement(ctx context.Context, userID, key string) (*model.CheckEntitlementResult, error)
	CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) (*model.ConsumeUsageResult, error)
	GrantSubscription(ctx context.Context, userID, planSlug string, periodEnd *time.Time) (*model.Subscription, error)
	RevokeSubscription(ctx context.Context, userID string) error
	HandleProviderWebhook(ctx context.Context, providerName string, headers map[string]string, body []byte) error
}

type billingService struct {
	repo         repository.Store
	identity     identityadapter.Client
	providers    map[string]providers.BillingProvider
	tierToPlan   map[string]string
	events       events.Publisher
	now          func() time.Time

	// CQRS usecase handlers. Reads + webhook stay in the service; the two clear
	// write commands delegate here.
	consumeUsage      *consume_usage.Handler
	grantSubscription *grant_subscription.Handler
}

// Deps holds service dependencies.
type Deps struct {
	Repo       repository.Store
	Identity   identityadapter.Client
	Providers  []providers.BillingProvider
	TierToPlan map[string]string
	Events     events.Publisher
}

// New constructs billing service.
func New(deps Deps) Service {
	pub := deps.Events
	if pub == nil {
		pub = events.NoopPublisher{}
	}
	providerMap := make(map[string]providers.BillingProvider, len(deps.Providers))
	for _, p := range deps.Providers {
		if p != nil {
			providerMap[p.ProviderName()] = p
		}
	}
	svc := &billingService{
		repo:       deps.Repo,
		identity:   deps.Identity,
		providers:  providerMap,
		tierToPlan: deps.TierToPlan,
		events:     pub,
		now:        time.Now,
	}
	svc.grantSubscription = grant_subscription.New(deps.Repo, pub)
	// consume_usage borrows the service's shared plan resolution via PlanResolver.
	svc.consumeUsage = consume_usage.New(deps.Repo, svc, pub)
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
	plan, _, err := s.resolvePlan(ctx, userID)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.ListPlanEntitlements(ctx, plan.ID)
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
		}
	}
	return view, nil
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
	return s.consumeUsage.Handle(ctx, consume_usage.Command{UserID: userID, Key: key, Amount: amount})
}

// GrantSubscription delegates to the grant_subscription CQRS command handler.
func (s *billingService) GrantSubscription(ctx context.Context, userID, planSlug string, periodEnd *time.Time) (*model.Subscription, error) {
	return s.grantSubscription.Handle(ctx, grant_subscription.Command{UserID: userID, PlanSlug: planSlug, PeriodEnd: periodEnd})
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
	_ = s.events.SubscriptionCancelled(ctx, &model.Subscription{UserID: userID})
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
	plan, err := s.repo.GetPlanBySlug(ctx, planSlug)
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
	if existing == nil {
		_ = s.events.SubscriptionCreated(ctx, sub)
	} else {
		_ = s.events.SubscriptionUpdated(ctx, sub)
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
			_ = s.events.SubscriptionCancelled(ctx, existing)
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
		plan, err := s.repo.GetPlanByID(ctx, sub.PlanID)
		return plan, sub, err
	}
	plan, err := s.repo.GetPlanBySlug(ctx, model.PlanFree)
	return plan, nil, err
}

func (s *billingService) findEntitlement(ctx context.Context, planID, key string) (*model.PlanEntitlement, error) {
	items, err := s.repo.ListPlanEntitlements(ctx, planID)
	if err != nil {
		return nil, err
	}
	for i := range items {
		if items[i].Key == key {
			return &items[i], nil
		}
	}
	return nil, fmt.Errorf("entitlement %q: %w", key, ErrNotFound)
}

func normalizeUsageKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "llm_evaluation" {
		return model.EntitlementAIEvaluationsPerDay
	}
	return key
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
