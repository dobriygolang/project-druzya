-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY,
    google_calendar_sync_enabled BOOLEAN NOT NULL DEFAULT false,
    google_refresh_token TEXT,
    google_oauth_state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
