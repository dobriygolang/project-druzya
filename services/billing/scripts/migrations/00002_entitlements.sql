-- +goose Up
-- +goose StatementBegin
DROP TABLE IF EXISTS usage_counters;
DROP TABLE IF EXISTS user_plans;
DROP TABLE IF EXISTS plan_limits;

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

CREATE TABLE provider_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider           TEXT NOT NULL,
    provider_event_id  TEXT NOT NULL,
    event_type         TEXT NOT NULL,
    payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_event_id)
);

INSERT INTO plans (id, slug, name, description, priority, is_active) VALUES
    (
        'f0000000-0000-4000-8000-000000000001',
        'free',
        'Free',
        'Default free tier',
        0,
        true
    ),
    (
        'f0000000-0000-4000-8000-000000000002',
        'pro_monthly',
        'Pro Monthly',
        'Paid monthly subscription',
        10,
        true
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO plan_entitlements (plan_id, key, value_json) VALUES
    ('f0000000-0000-4000-8000-000000000001', 'ai_evaluations_per_day', '{"type":"counter","limit":5,"period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'mock_interviews_per_month', '{"type":"counter","limit":2,"period":"month"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'code_runs_per_day', '{"type":"counter","limit":30,"period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'hidden_tests_enabled', '{"type":"bool","value":false}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'company_templates_enabled', '{"type":"bool","value":false}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'recommendations_enabled', '{"type":"bool","value":true}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'ai_evaluations_per_day', '{"type":"counter","limit":100,"period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'mock_interviews_per_month', '{"type":"counter","limit":30,"period":"month"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'code_runs_per_day', '{"type":"counter","limit":500,"period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'hidden_tests_enabled', '{"type":"bool","value":true}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'company_templates_enabled', '{"type":"bool","value":true}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'recommendations_enabled', '{"type":"bool","value":true}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'advanced_feedback_enabled', '{"type":"bool","value":true}'::jsonb)
ON CONFLICT (plan_id, key) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS provider_events;
DROP TABLE IF EXISTS usage_counters;
DROP TABLE IF EXISTS provider_accounts;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS plan_entitlements;
DROP TABLE IF EXISTS plans;
-- +goose StatementEnd
