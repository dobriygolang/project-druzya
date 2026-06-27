-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE plan_limits (
    plan_id        TEXT NOT NULL,
    metric         TEXT NOT NULL,
    monthly_limit  INT NOT NULL,
    PRIMARY KEY (plan_id, metric)
);

INSERT INTO plan_limits (plan_id, metric, monthly_limit) VALUES
    ('free', 'llm_evaluation', 100);

CREATE TABLE user_plans (
    user_id    UUID PRIMARY KEY,
    plan_id    TEXT NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usage_counters (
    user_id    UUID NOT NULL,
    period     TEXT NOT NULL,
    metric     TEXT NOT NULL,
    count      INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, period, metric)
);

CREATE INDEX usage_counters_period_idx ON usage_counters (period);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS usage_counters;
DROP TABLE IF EXISTS user_plans;
DROP TABLE IF EXISTS plan_limits;
-- +goose StatementEnd
