package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Store is the persistence port used by billing domain logic.
type Store interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	GetPlanBySlug(ctx context.Context, slug string) (*model.Plan, error)
	GetPlanByID(ctx context.Context, id string) (*model.Plan, error)
	ListActivePlans(ctx context.Context) ([]model.Plan, error)
	ListPlanEntitlements(ctx context.Context, planID string) ([]model.PlanEntitlement, error)
	GetActiveSubscription(ctx context.Context, userID string) (*model.Subscription, error)
	UpsertSubscription(ctx context.Context, sub *model.Subscription) error
	CancelActiveSubscriptions(ctx context.Context, userID string) error
	UpsertProviderAccount(ctx context.Context, acct *model.ProviderAccount) error
	GetProviderAccount(ctx context.Context, provider, providerUserID string) (*model.ProviderAccount, error)
	MarkProviderEventProcessed(ctx context.Context, provider, providerEventID, eventType string, payload json.RawMessage) (bool, error)
	FindSubscriptionByProviderRef(ctx context.Context, provider, providerSubscriptionID string) (*model.Subscription, error)
	GetUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time) (int, error)
	ConsumeUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount, limit int) (int, error)
	ConsumeUsageUnlimited(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount int) (int, error)
	ReleaseUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount int) (int, error)
	MarkUsageReleaseProcessed(ctx context.Context, idempotencyKey, userID, key string, amount int) (bool, error)
	HasUsedProTrial(ctx context.Context, userID string) (bool, error)
	UpdatePlanEntitlement(ctx context.Context, planID, key string, valueJSON json.RawMessage) error
}

var _ Store = (*Repository)(nil)
