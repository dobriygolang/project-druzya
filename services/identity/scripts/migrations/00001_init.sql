-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username     TEXT NOT NULL UNIQUE,
    telegram_id  BIGINT UNIQUE,
    yandex_id    TEXT UNIQUE,
    avatar_url   TEXT NOT NULL DEFAULT '',
    timezone     TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_has_provider CHECK (
        telegram_id IS NOT NULL OR yandex_id IS NOT NULL
    )
);

CREATE INDEX users_created_at_idx ON users (created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
