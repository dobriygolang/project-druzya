-- +goose Up
-- +goose StatementBegin
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
DROP TABLE IF EXISTS domain_outbox;
-- +goose StatementEnd
