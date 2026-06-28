package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

var ErrLimitExceeded = errors.New("limit exceeded")

type Repository struct {
	pg *Pool
}

// New constructs a billing repository.
func New(pg *Pool) *Repository {
	return &Repository{pg: pg}
}

func (r *Repository) GetPlanBySlug(ctx context.Context, slug string) (*model.Plan, error) {
	return r.scanPlan(r.conn(ctx).QueryRow(ctx, `
		SELECT id, slug, name, description, priority, is_active, metadata, created_at, updated_at
		FROM plans WHERE slug = $1 AND is_active = true
	`, slug))
}

func (r *Repository) GetPlanByID(ctx context.Context, id string) (*model.Plan, error) {
	planID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid plan id: %w", err)
	}
	return r.scanPlan(r.conn(ctx).QueryRow(ctx, `
		SELECT id, slug, name, description, priority, is_active, metadata, created_at, updated_at
		FROM plans WHERE id = $1
	`, planID))
}

func (r *Repository) ListActivePlans(ctx context.Context) ([]model.Plan, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, slug, name, description, priority, is_active, metadata, created_at, updated_at
		FROM plans WHERE is_active = true ORDER BY priority ASC, slug ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("ListActivePlans: %w", err)
	}
	defer rows.Close()

	var out []model.Plan
	for rows.Next() {
		plan, err := r.scanPlan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *plan)
	}
	return out, rows.Err()
}

func (r *Repository) ListPlanEntitlements(ctx context.Context, planID string) ([]model.PlanEntitlement, error) {
	pid, err := uuid.Parse(planID)
	if err != nil {
		return nil, fmt.Errorf("invalid plan id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, plan_id, key, value_json, created_at, updated_at
		FROM plan_entitlements WHERE plan_id = $1 ORDER BY key
	`, pid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.PlanEntitlement, 0, 16)
	for rows.Next() {
		item, err := scanPlanEntitlement(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func (r *Repository) GetActiveSubscription(ctx context.Context, userID string) (*model.Subscription, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT s.id, s.user_id, s.plan_id, p.slug, s.provider, s.provider_subscription_id,
			s.status, s.current_period_start, s.current_period_end, s.cancel_at_period_end,
			s.metadata, s.created_at, s.updated_at
		FROM subscriptions s
		JOIN plans p ON p.id = s.plan_id
		WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
			AND (s.current_period_end IS NULL OR s.current_period_end > now())
		ORDER BY p.priority DESC, s.current_period_end DESC NULLS LAST, s.created_at DESC
		LIMIT 1
	`, uid)
	return r.scanSubscription(row)
}

func (r *Repository) UpsertSubscription(ctx context.Context, sub *model.Subscription) error {
	userID, err := uuid.Parse(sub.UserID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}
	planID, err := uuid.Parse(sub.PlanID)
	if err != nil {
		return fmt.Errorf("invalid plan id: %w", err)
	}
	subID := sub.ID
	if subID == "" {
		subID = uuid.NewString()
		sub.ID = subID
	}
	parsedSubID, err := uuid.Parse(subID)
	if err != nil {
		return fmt.Errorf("invalid subscription id: %w", err)
	}
	meta := sub.Metadata
	if meta == nil {
		meta = json.RawMessage(`{}`)
	}
	now := time.Now().UTC()
	if sub.CreatedAt.IsZero() {
		sub.CreatedAt = now
	}
	sub.UpdatedAt = now

	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO subscriptions (
			id, user_id, plan_id, provider, provider_subscription_id, status,
			current_period_start, current_period_end, cancel_at_period_end, metadata, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (id) DO UPDATE SET
			plan_id = EXCLUDED.plan_id,
			provider = EXCLUDED.provider,
			provider_subscription_id = EXCLUDED.provider_subscription_id,
			status = EXCLUDED.status,
			current_period_start = EXCLUDED.current_period_start,
			current_period_end = EXCLUDED.current_period_end,
			cancel_at_period_end = EXCLUDED.cancel_at_period_end,
			metadata = EXCLUDED.metadata,
			updated_at = EXCLUDED.updated_at
	`, parsedSubID, userID, planID, sub.Provider, sub.ProviderSubscriptionID, sub.Status,
		sub.CurrentPeriodStart, sub.CurrentPeriodEnd, sub.CancelAtPeriodEnd, meta, sub.CreatedAt, sub.UpdatedAt)
	return err
}

func (r *Repository) CancelActiveSubscriptions(ctx context.Context, userID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}
	_, err = r.conn(ctx).Exec(ctx, `
		UPDATE subscriptions SET status = 'cancelled', updated_at = now()
		WHERE user_id = $1 AND status IN ('active', 'trialing')
	`, uid)
	return err
}

func (r *Repository) UpsertProviderAccount(ctx context.Context, acct *model.ProviderAccount) error {
	userID, err := uuid.Parse(acct.UserID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}
	id := acct.ID
	if id == "" {
		id = uuid.NewString()
		acct.ID = id
	}
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	meta := acct.Metadata
	if meta == nil {
		meta = json.RawMessage(`{}`)
	}
	now := time.Now().UTC()
	if acct.CreatedAt.IsZero() {
		acct.CreatedAt = now
	}
	acct.UpdatedAt = now

	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO provider_accounts (
			id, user_id, provider, provider_user_id, provider_username, metadata, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (provider, provider_user_id) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			provider_username = EXCLUDED.provider_username,
			metadata = EXCLUDED.metadata,
			updated_at = EXCLUDED.updated_at
	`, parsedID, userID, acct.Provider, acct.ProviderUserID, acct.ProviderUsername, meta, acct.CreatedAt, acct.UpdatedAt)
	return err
}

func (r *Repository) GetProviderAccount(ctx context.Context, provider, providerUserID string) (*model.ProviderAccount, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, provider, provider_user_id, provider_username, metadata, created_at, updated_at
		FROM provider_accounts WHERE provider = $1 AND provider_user_id = $2
	`, provider, providerUserID)
	return scanProviderAccount(row)
}

func (r *Repository) MarkProviderEventProcessed(ctx context.Context, provider, providerEventID, eventType string, payload json.RawMessage) (bool, error) {
	if payload == nil {
		payload = json.RawMessage(`{}`)
	}
	tag, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO provider_events (provider, provider_event_id, event_type, payload)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (provider, provider_event_id) DO NOTHING
	`, provider, providerEventID, eventType, payload)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Repository) GetUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time) (int, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, fmt.Errorf("invalid user id: %w", err)
	}
	var used int
	err = r.conn(ctx).QueryRow(ctx, `
		SELECT used FROM usage_counters
		WHERE user_id = $1 AND entitlement_key = $2 AND period_start = $3 AND period_end = $4
	`, uid, key, periodStart.UTC(), periodEnd.UTC()).Scan(&used)
	if isNoRows(err) {
		return 0, nil
	}
	return used, err
}

// ConsumeUsage atomically increments a usage counter if it stays within limit.
// A single INSERT ... ON CONFLICT ... WHERE statement avoids the first-insert
// race: concurrent first consumptions are serialized by the unique constraint,
// and the WHERE guard rejects increments that would exceed the limit.
func (r *Repository) ConsumeUsage(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount, limit int) (int, error) {
	if amount <= 0 {
		amount = 1
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, fmt.Errorf("invalid user id: %w", err)
	}
	// A single request larger than the whole limit can never fit; the INSERT
	// branch below is not gated by the ON CONFLICT WHERE clause, so guard it here.
	if amount > limit {
		return 0, ErrLimitExceeded
	}
	start := periodStart.UTC()
	end := periodEnd.UTC()

	var used int
	err = r.conn(ctx).QueryRow(ctx, `
		INSERT INTO usage_counters (user_id, entitlement_key, period_start, period_end, used)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, entitlement_key, period_start, period_end) DO UPDATE
		SET used = usage_counters.used + EXCLUDED.used, updated_at = now()
		WHERE usage_counters.used + EXCLUDED.used <= $6
		RETURNING used
	`, uid, key, start, end, amount, limit).Scan(&used)
	if isNoRows(err) {
		return 0, ErrLimitExceeded
	}
	if err != nil {
		return 0, err
	}
	return used, nil
}

func (r *Repository) ConsumeUsageUnlimited(ctx context.Context, userID, key string, periodStart, periodEnd time.Time, amount int) (int, error) {
	if amount <= 0 {
		amount = 1
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, fmt.Errorf("invalid user id: %w", err)
	}
	start := periodStart.UTC()
	end := periodEnd.UTC()
	var used int
	err = r.conn(ctx).QueryRow(ctx, `
		INSERT INTO usage_counters (user_id, entitlement_key, period_start, period_end, used)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, entitlement_key, period_start, period_end) DO UPDATE
		SET used = usage_counters.used + EXCLUDED.used, updated_at = now()
		RETURNING used
	`, uid, key, start, end, amount).Scan(&used)
	return used, err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func (r *Repository) scanPlan(row rowScanner) (*model.Plan, error) {
	var p model.Plan
	var id uuid.UUID
	var meta []byte
	if err := row.Scan(&id, &p.Slug, &p.Name, &p.Description, &p.Priority, &p.IsActive, &meta, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	p.ID = id.String()
	p.Metadata = meta
	return &p, nil
}

func scanPlanEntitlement(row rowScanner) (*model.PlanEntitlement, error) {
	var e model.PlanEntitlement
	var id, planID uuid.UUID
	var raw []byte
	if err := row.Scan(&id, &planID, &e.Key, &raw, &e.CreatedAt, &e.UpdatedAt); err != nil {
		return nil, err
	}
	e.ID = id.String()
	e.PlanID = planID.String()
	e.ValueJSON = raw
	return &e, nil
}

func (r *Repository) scanSubscription(row rowScanner) (*model.Subscription, error) {
	var s model.Subscription
	var id, userID, planID uuid.UUID
	var meta []byte
	if err := row.Scan(
		&id, &userID, &planID, &s.PlanSlug, &s.Provider, &s.ProviderSubscriptionID,
		&s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.CancelAtPeriodEnd,
		&meta, &s.CreatedAt, &s.UpdatedAt,
	); err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	s.ID = id.String()
	s.UserID = userID.String()
	s.PlanID = planID.String()
	s.Metadata = meta
	return &s, nil
}

func (r *Repository) FindSubscriptionByProviderRef(ctx context.Context, provider, providerSubscriptionID string) (*model.Subscription, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT s.id, s.user_id, s.plan_id, p.slug, s.provider, s.provider_subscription_id,
			s.status, s.current_period_start, s.current_period_end, s.cancel_at_period_end,
			s.metadata, s.created_at, s.updated_at
		FROM subscriptions s
		JOIN plans p ON p.id = s.plan_id
		WHERE s.provider = $1 AND s.provider_subscription_id = $2
	`, provider, providerSubscriptionID)
	return r.scanSubscription(row)
}

func scanProviderAccount(row rowScanner) (*model.ProviderAccount, error) {
	var a model.ProviderAccount
	var id, userID uuid.UUID
	var meta []byte
	if err := row.Scan(&id, &userID, &a.Provider, &a.ProviderUserID, &a.ProviderUsername, &meta, &a.CreatedAt, &a.UpdatedAt); err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	a.ID = id.String()
	a.UserID = userID.String()
	a.Metadata = meta
	return &a, nil
}
