-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE projects (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    name       TEXT NOT NULL,
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON projects (user_id, position);

CREATE TABLE epics (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_epics_project ON epics (project_id, position);

CREATE TABLE sprints (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    goal       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'active',
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX idx_sprints_project_status ON sprints (project_id, status, position);

CREATE TABLE tasks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id  UUID NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    epic_id    UUID REFERENCES epics (id) ON DELETE SET NULL,
    title      TEXT NOT NULL,
    done       BOOLEAN NOT NULL DEFAULT false,
    position   INT NOT NULL DEFAULT 0,
    source     TEXT NOT NULL DEFAULT 'user',
    metadata   JSONB NOT NULL DEFAULT '{}',
    dedup_key  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_sprint ON tasks (sprint_id, position);
CREATE UNIQUE INDEX idx_tasks_dedup ON tasks (sprint_id, dedup_key) WHERE dedup_key IS NOT NULL;

CREATE TABLE domain_outbox (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name   TEXT NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT 'pending',
    locked_until TIMESTAMPTZ,
    retry_count  INT NOT NULL DEFAULT 0,
    last_error   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_claim ON domain_outbox (status, event_name, created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS domain_outbox;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS sprints;
DROP TABLE IF EXISTS epics;
DROP TABLE IF EXISTS projects;
-- +goose StatementEnd
