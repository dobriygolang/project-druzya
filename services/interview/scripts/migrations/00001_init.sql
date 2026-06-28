-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE interview_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    template_id   UUID,
    mode          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    passing_score INT NOT NULL DEFAULT 85,
    total_score   NUMERIC,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT interview_sessions_mode_check CHECK (
        mode IN (
            'company_interview',
            'algorithms_training',
            'live_coding_training',
            'system_design_training',
            'behavioral_training',
            'sql_training',
            'retry_mistakes'
        )
    ),
    CONSTRAINT interview_sessions_status_check CHECK (
        status IN ('active', 'completed', 'cancelled', 'expired')
    )
);

CREATE INDEX interview_sessions_user_id_status_idx ON interview_sessions (user_id, status);
CREATE UNIQUE INDEX interview_sessions_one_active_per_user_idx
    ON interview_sessions (user_id) WHERE status = 'active';

CREATE TABLE interview_session_sections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    section_type  TEXT NOT NULL,
    title         TEXT NOT NULL,
    position      INT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    passing_score INT,
    score         NUMERIC,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT interview_session_sections_status_check CHECK (
        status IN ('pending', 'active', 'completed')
    ),
    CONSTRAINT interview_session_sections_position_unique UNIQUE (session_id, position)
);

CREATE INDEX interview_session_sections_session_id_position_idx
    ON interview_session_sections (session_id, position);

CREATE TABLE session_tasks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES interview_session_sections(id) ON DELETE CASCADE,
    task_id    UUID NOT NULL,
    position   INT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'assigned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT session_tasks_status_check CHECK (
        status IN ('assigned', 'submitted', 'evaluated', 'skipped')
    ),
    CONSTRAINT session_tasks_section_position_unique UNIQUE (section_id, position)
);

CREATE INDEX session_tasks_session_id_position_idx ON session_tasks (session_id, position);
CREATE INDEX session_tasks_section_id_position_idx ON session_tasks (section_id, position);
CREATE INDEX session_tasks_task_id_idx ON session_tasks (task_id);

CREATE TABLE attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    session_task_id UUID NOT NULL REFERENCES session_tasks(id) ON DELETE RESTRICT,
    task_id         UUID NOT NULL,
    answer_text     TEXT,
    code            TEXT,
    language        TEXT,
    attachments     JSONB NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'submitted',
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT attempts_status_check CHECK (
        status IN ('submitted', 'evaluating', 'evaluated', 'failed', 'cancelled')
    ),
    CONSTRAINT attempts_session_task_unique UNIQUE (session_task_id)
);

CREATE INDEX attempts_user_id_created_at_idx ON attempts (user_id, created_at DESC);
CREATE INDEX attempts_session_task_id_idx ON attempts (session_task_id);

CREATE TABLE evaluation_summaries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    score      NUMERIC NOT NULL,
    passed     BOOLEAN NOT NULL,
    summary    TEXT,
    feedback   JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT evaluation_summaries_attempt_unique UNIQUE (attempt_id)
);


CREATE TABLE retry_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL,
    task_id           UUID NOT NULL,
    source_attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE RESTRICT,
    session_id        UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
    reason            TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',
    next_retry_at     TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT retry_items_status_check CHECK (
        status IN ('pending', 'in_progress', 'completed', 'dismissed')
    )
);

CREATE INDEX retry_items_user_id_status_idx ON retry_items (user_id, status);
CREATE INDEX retry_items_source_attempt_id_idx ON retry_items (source_attempt_id);

CREATE UNIQUE INDEX retry_items_user_task_active_idx
    ON retry_items (user_id, task_id)
    WHERE status IN ('pending', 'in_progress');

CREATE TABLE domain_outbox (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name   TEXT NOT NULL,
    payload      JSONB NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    locked_until TIMESTAMPTZ,
    retry_count  INT NOT NULL DEFAULT 0,
    last_error   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT domain_outbox_status_check CHECK (
        status IN ('pending', 'processing', 'published', 'failed')
    )
);

CREATE INDEX domain_outbox_pending_idx
    ON domain_outbox (created_at)
    WHERE status IN ('pending', 'failed');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
