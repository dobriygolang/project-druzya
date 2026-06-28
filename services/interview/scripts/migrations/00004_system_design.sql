-- +goose Up
CREATE TABLE system_design_workspaces (
    session_task_id UUID PRIMARY KEY REFERENCES session_tasks (id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    session_id      UUID        NOT NULL,
    task_id         UUID        NOT NULL,
    phase           TEXT        NOT NULL DEFAULT 'brief',
    functional_context JSONB    NOT NULL DEFAULT '{}'::jsonb,
    nfr             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    diagram         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    api_spec        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    data_model      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    infrastructure  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    wrap_up         TEXT,
    version         INT         NOT NULL DEFAULT 1,
    phase_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sd_workspaces_session ON system_design_workspaces (session_id);
CREATE INDEX idx_sd_workspaces_user ON system_design_workspaces (user_id);

CREATE TABLE system_design_turns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_task_id UUID        NOT NULL REFERENCES system_design_workspaces (session_task_id) ON DELETE CASCADE,
    phase           TEXT        NOT NULL,
    role            TEXT        NOT NULL CHECK (role IN ('user', 'interviewer', 'system')),
    content         TEXT        NOT NULL,
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sd_turns_session_task ON system_design_turns (session_task_id, created_at);

-- +goose Down
DROP TABLE IF EXISTS system_design_turns;
DROP TABLE IF EXISTS system_design_workspaces;
