package billing

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound is returned when billing entity is missing.
var ErrNotFound = errors.New("not found")

// PlanEntitlementSpec is a plan limit definition.
type PlanEntitlementSpec struct {
	Type      string
	Limit     *int
	Unlimited bool
	Period    string
	Value     bool
}

// PlanCatalog is a public plan card.
type PlanCatalog struct {
	Slug       string
	Name       string
	Tagline    string
	Highlight  bool
	Highlights []string
	Features   map[string]bool
	Limits     map[string]PlanEntitlementSpec
}

// UsageLimit is resolved usage for one entitlement key.
type UsageLimit struct {
	Used        int
	Limit       *int
	Remaining   *int
	PeriodStart time.Time
	PeriodEnd   time.Time
	Unlimited   bool
}

// UserEntitlements is a user's plan and usage view.
type UserEntitlements struct {
	UserID   string
	PlanSlug string
	PlanName string
	Features map[string]bool
	Limits   map[string]UsageLimit
}

// GrantSubscriptionInput grants or replaces a subscription.
type GrantSubscriptionInput struct {
	UserID          string
	PlanSlug        string
	CurrentPeriodEnd *time.Time
}

// GrantSubscriptionResult is the created subscription summary.
type GrantSubscriptionResult struct {
	SubscriptionID string
	PlanSlug       string
	Status         string
}

// Client reads billing catalog and admin APIs via gRPC.
type Client interface {
	Ping(ctx context.Context) error
	ListPlans(ctx context.Context) ([]PlanCatalog, error)
	GetUserEntitlements(ctx context.Context, userID string) (*UserEntitlements, error)
	GrantSubscription(ctx context.Context, input GrantSubscriptionInput) (*GrantSubscriptionResult, error)
	RevokeSubscription(ctx context.Context, userID string) (bool, error)
	GetPlatformStats(ctx context.Context) (int64, error)
	GetOpsStats(ctx context.Context) (*OpsStats, error)
}

// OpsStats is database footprint and process runtime metrics.
type OpsStats struct {
	ServiceName       string
	DatabaseName      string
	DatabaseSizeBytes int64
	MemoryAllocBytes  int64
	MemorySysBytes    int64
	Goroutines        int
	HTTPRPS           float64
}
