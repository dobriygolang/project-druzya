-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE code_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    language        TEXT NOT NULL,
    code            TEXT NOT NULL,
    stdin           TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'queued',
    run_type        TEXT NOT NULL DEFAULT 'custom',
    stdout          TEXT,
    stderr          TEXT,
    compile_output  TEXT,
    error           TEXT,
    exit_code       INT,
    time_ms         INT,
    memory_kb       INT,
    tests_total     INT NOT NULL DEFAULT 0,
    tests_passed    INT NOT NULL DEFAULT 0,
    test_results    JSONB NOT NULL DEFAULT '[]'::jsonb,
    runner          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX code_runs_user_created_idx ON code_runs (user_id, created_at DESC);
CREATE INDEX code_runs_status_created_idx ON code_runs (status, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
