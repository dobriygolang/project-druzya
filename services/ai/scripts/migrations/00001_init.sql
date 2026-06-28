-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE evaluation_jobs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id     UUID NOT NULL UNIQUE,
    user_id        UUID NOT NULL,
    task_id        UUID NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    retry_count    INT NOT NULL DEFAULT 0,
    retryable      BOOLEAN NOT NULL DEFAULT true,
    error          TEXT,
    next_retry_at  TIMESTAMPTZ,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX evaluation_jobs_status_idx ON evaluation_jobs (status);
CREATE INDEX evaluation_jobs_next_retry_at_idx ON evaluation_jobs (next_retry_at) WHERE next_retry_at IS NOT NULL;

CREATE TABLE model_calls (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_job_id  UUID NOT NULL REFERENCES evaluation_jobs (id) ON DELETE CASCADE,
    provider           TEXT NOT NULL,
    model              TEXT NOT NULL,
    request_json       JSONB NOT NULL DEFAULT '{}',
    response_json      JSONB NOT NULL DEFAULT '{}',
    parsed_result      JSONB,
    prompt_tokens      INT,
    completion_tokens  INT,
    total_tokens       INT,
    cost_usd           NUMERIC(12, 6),
    latency_ms         INT,
    error              TEXT,
    call_no            INT NOT NULL DEFAULT 1,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX model_calls_evaluation_job_id_idx ON model_calls (evaluation_job_id);

CREATE TABLE llm_runtime_config (
    id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    version    BIGINT NOT NULL DEFAULT 0,
    config     JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO llm_runtime_config (id, version, config) VALUES (1, 0, '{}');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
