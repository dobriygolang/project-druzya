-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    priority    INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plan_entitlements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id     UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value_json  JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (plan_id, key)
);

CREATE TABLE subscriptions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL,
    plan_id                  UUID NOT NULL REFERENCES plans(id),
    provider                 TEXT NOT NULL,
    provider_subscription_id TEXT,
    status                   TEXT NOT NULL,
    current_period_start     TIMESTAMPTZ,
    current_period_end       TIMESTAMPTZ,
    cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false,
    metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_user_status_idx ON subscriptions (user_id, status);
CREATE INDEX subscriptions_provider_sub_idx ON subscriptions (provider, provider_subscription_id);
CREATE UNIQUE INDEX subscriptions_one_active_per_user
    ON subscriptions (user_id)
    WHERE status IN ('active', 'trialing');

CREATE TABLE provider_accounts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL,
    provider          TEXT NOT NULL,
    provider_user_id  TEXT NOT NULL,
    provider_username TEXT,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id),
    UNIQUE (user_id, provider)
);

CREATE TABLE usage_counters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    entitlement_key TEXT NOT NULL,
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    used            INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, entitlement_key, period_start, period_end)
);

CREATE INDEX usage_counters_user_key_idx ON usage_counters (user_id, entitlement_key);
CREATE INDEX usage_counters_period_end_idx ON usage_counters (period_end);

CREATE TABLE usage_release_dedup (
    idempotency_key  TEXT PRIMARY KEY,
    user_id          UUID NOT NULL,
    entitlement_key  TEXT NOT NULL,
    amount           INT NOT NULL CHECK (amount > 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE provider_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider           TEXT NOT NULL,
    provider_event_id  TEXT NOT NULL,
    event_type         TEXT NOT NULL,
    payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_event_id)
);

INSERT INTO plans (id, slug, name, description, priority, is_active, metadata) VALUES
    (
        'f0000000-0000-4000-8000-000000000001',
        'free',
        'Free',
        'Full free — unlimited quotas',
        0,
        true,
        '{"tagline":"Всё без лимитов","highlight":false}'::jsonb
    ),
    (
        'f0000000-0000-4000-8000-000000000002',
        'pro_monthly',
        'Pro',
        'Paid monthly subscription',
        10,
        true,
        '{"tagline":"Без лимитов на фокус и заметки","highlight":true}'::jsonb
    );

INSERT INTO plan_entitlements (plan_id, key, value_json) VALUES
    ('f0000000-0000-4000-8000-000000000001', 'code_runs_per_day', '{"type":"counter","period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'cloud_notes_count', '{"type":"gauge"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'live_rooms_per_month', '{"type":"counter","period":"month"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'live_rooms_concurrent', '{"type":"gauge"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'code_runs_per_day', '{"type":"counter","limit":500,"period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'cloud_notes_count', '{"type":"gauge"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'live_rooms_per_month', '{"type":"counter","limit":30,"period":"month"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'live_rooms_concurrent', '{"type":"gauge","limit":5}'::jsonb);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
