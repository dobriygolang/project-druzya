-- +goose Up
-- Run `make migrate-learning-plan-to-tracker` BEFORE this migration in production.
DROP INDEX IF EXISTS learning_plan_items_retry_task_active_uniq;
DROP INDEX IF EXISTS learning_plan_items_user_status_idx;
DROP TABLE IF EXISTS learning_plan_items;

-- +goose Down
-- +goose StatementBegin
CREATE TABLE learning_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    recommendation_id UUID REFERENCES recommendations (id),
    type TEXT NOT NULL,
    task_id UUID,
    skill_key TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    position INT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX learning_plan_items_retry_task_active_uniq
    ON learning_plan_items (user_id, type, (metadata ->> 'task_id'))
    WHERE status IN ('pending', 'in_progress') AND type = 'retry_task';

CREATE INDEX IF NOT EXISTS learning_plan_items_user_status_idx
    ON learning_plan_items (user_id, status);
-- +goose StatementEnd
