-- +goose Up
-- +goose StatementBegin
CREATE TABLE usage_release_dedup (
    idempotency_key  TEXT PRIMARY KEY,
    user_id          UUID NOT NULL,
    entitlement_key  TEXT NOT NULL,
    amount           INT NOT NULL CHECK (amount > 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
