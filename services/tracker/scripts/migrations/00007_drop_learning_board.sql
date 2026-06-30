-- +goose Up
-- +goose StatementBegin
CREATE TABLE work_tasks (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'todo',
    kind                   TEXT NOT NULL DEFAULT 'custom',
    title                  TEXT NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ,
    scheduled_start        TIMESTAMPTZ,
    scheduled_duration_min INT,
    google_event_id        TEXT,
    archived_at            TIMESTAMPTZ
);

CREATE INDEX idx_work_tasks_user_active ON work_tasks (user_id, updated_at DESC)
    WHERE archived_at IS NULL;

INSERT INTO work_tasks (
    id, user_id, status, kind, title, created_at, updated_at, completed_at,
    scheduled_start, scheduled_duration_min, google_event_id, archived_at
)
SELECT
    t.id,
    p.user_id,
    COALESCE(NULLIF(t.board_status, ''), CASE WHEN t.done THEN 'done' ELSE 'todo' END),
    COALESCE(NULLIF(t.metadata->>'hone_kind', ''), 'custom'),
    t.title,
    t.created_at,
    t.updated_at,
    t.completed_at,
    t.scheduled_start,
    t.scheduled_duration_min,
    NULLIF(t.metadata->>'google_event_id', ''),
    t.archived_at
FROM tasks t
JOIN sprints s ON s.id = t.sprint_id
JOIN projects p ON p.id = s.project_id;

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS sprints;
DROP TABLE IF EXISTS epics;
DROP TABLE IF EXISTS projects;

ALTER TABLE user_settings DROP COLUMN IF EXISTS deferred_sprint_epic_names;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS deferred_sprint_epic_names TEXT[] NOT NULL DEFAULT '{}';

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
    status     TEXT NOT NULL DEFAULT 'open',
    hold_open  BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
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
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id              UUID NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    epic_id                UUID REFERENCES epics (id) ON DELETE SET NULL,
    title                  TEXT NOT NULL,
    done                   BOOLEAN NOT NULL DEFAULT false,
    position               INT NOT NULL DEFAULT 0,
    estimate_days          REAL NOT NULL DEFAULT 1,
    source                 TEXT NOT NULL DEFAULT 'user',
    metadata               JSONB NOT NULL DEFAULT '{}',
    dedup_key              TEXT,
    board_status           TEXT NOT NULL DEFAULT 'todo',
    scheduled_start        TIMESTAMPTZ,
    scheduled_duration_min INT,
    archived_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ
);

CREATE INDEX idx_tasks_sprint ON tasks (sprint_id, position);

DROP TABLE IF EXISTS work_tasks;
-- +goose StatementEnd
