-- +goose Up
-- +goose StatementBegin
CREATE TABLE user_skill_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    readiness_score INT NOT NULL DEFAULT 0,
    profile_summary TEXT,
    summary_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE skill_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    skill_key TEXT NOT NULL,
    score INT NOT NULL,
    confidence INT NOT NULL DEFAULT 0,
    attempts_count INT NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, skill_key)
);

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL,
    skill_key TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    dismissed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX recommendations_improve_skill_active_uniq
    ON recommendations (user_id, type, skill_key)
    WHERE status = 'active' AND type = 'improve_skill';

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

CREATE TABLE processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer TEXT NOT NULL,
    event_id TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (consumer, event_id)
);

CREATE INDEX IF NOT EXISTS recommendations_user_status_idx
    ON recommendations (user_id, status);

CREATE INDEX IF NOT EXISTS learning_plan_items_user_status_idx
    ON learning_plan_items (user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS recommendations_take_mock_active_uniq
    ON recommendations (user_id, type)
    WHERE status = 'active' AND type = 'take_mock_interview';

CREATE UNIQUE INDEX IF NOT EXISTS recommendations_special_active_uniq
    ON recommendations (user_id, type, skill_key)
    WHERE status = 'active' AND type IN ('rewrite_answer', 'practice_section');

CREATE TABLE article_reads (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    article_slug TEXT NOT NULL,
    read_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, article_slug)
);

CREATE INDEX article_reads_user_id_idx ON article_reads (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
