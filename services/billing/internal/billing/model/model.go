package model

import (
	"encoding/json"
	"time"
)

const (
	PlanFree       = "free"
	PlanProMonthly = "pro_monthly"

	ProviderInternal = "internal"
	ProviderTribute  = "tribute"

	SubStatusActive    = "active"
	SubStatusTrialing  = "trialing"
	SubStatusCancelled = "cancelled"
	SubStatusExpired   = "expired"
	SubStatusPastDue   = "past_due"
	SubStatusPaused    = "paused"

	TrialKindPro = "pro_trial"

	EntitlementCodeRunsPerDay      = "code_runs_per_day"
	EntitlementCloudNotesCount     = "cloud_notes_count"
	EntitlementLiveRoomsPerMonth   = "live_rooms_per_month"
	EntitlementLiveRoomsConcurrent     = "live_rooms_concurrent"
)

// Plan is a billable tier.
type Plan struct {
	ID          string
	Slug        string
	Name        string
	Description *string
	Priority    int
	IsActive    bool
	Metadata    json.RawMessage
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// PlanEntitlement is one feature/limit on a plan.
type PlanEntitlement struct {
	ID         string
	PlanID     string
	Key        string
	ValueJSON  json.RawMessage
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Subscription links a user to a plan via a provider.
type Subscription struct {
	ID                     string
	UserID                 string
	PlanID                 string
	PlanSlug               string
	Provider               string
	ProviderSubscriptionID *string
	Status                 string
	CurrentPeriodStart     *time.Time
	CurrentPeriodEnd       *time.Time
	CancelAtPeriodEnd      bool
	Metadata               json.RawMessage
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

// ProviderAccount maps an external provider identity to a user.
type ProviderAccount struct {
	ID                string
	UserID            string
	Provider          string
	ProviderUserID    string
	ProviderUsername  *string
	Metadata          json.RawMessage
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// UsageCounter tracks consumed quota for a period.
type UsageCounter struct {
	ID             string
	UserID         string
	EntitlementKey string
	PeriodStart    time.Time
	PeriodEnd      time.Time
	Used           int
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// UsageLimitState is resolved limit usage for one entitlement key.
type UsageLimitState struct {
	Key         string
	Limit       *int
	Used        int
	Remaining   *int
	PeriodStart time.Time
	PeriodEnd   time.Time
	Unlimited   bool
}

// EntitlementsView is the aggregated billing state for a user.
type EntitlementsView struct {
	UserID         string
	PlanSlug       string
	PlanName       string
	Features       map[string]bool
	Limits         map[string]UsageLimitState
	IsTrialing     bool
	TrialAvailable bool
	TrialDays      int
	TrialEndsAt    *time.Time
}

// CheckEntitlementResult is the outcome of a feature gate.
type CheckEntitlementResult struct {
	Allowed bool
	Value   bool
	Reason  string
}

// ConsumeUsageResult is the outcome of atomic usage consumption.
type ConsumeUsageResult struct {
	Allowed   bool
	Used      int
	Remaining *int
	Limit     *int
	Reason    string
}

// ReleaseUsageResult is the outcome of compensating consumed usage.
type ReleaseUsageResult struct {
	Released  bool
	Used      int
	Remaining *int
	Limit     *int
	Reason    string
}
