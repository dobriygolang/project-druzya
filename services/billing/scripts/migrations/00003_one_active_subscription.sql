-- +goose Up
-- +goose StatementBegin
-- Enforce at most one active/trialing subscription per user. Grant and webhook
-- flows cancel previous subscriptions before inserting a new one in the same
-- transaction, so this index turns a silent multi-active state into an error.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_per_user
    ON subscriptions (user_id)
    WHERE status IN ('active', 'trialing');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS subscriptions_one_active_per_user;
-- +goose StatementEnd
