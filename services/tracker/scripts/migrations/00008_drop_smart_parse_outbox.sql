-- +goose Up
-- +goose StatementBegin
ALTER TABLE user_settings DROP COLUMN IF EXISTS smart_parse_enabled;
DROP TABLE IF EXISTS domain_outbox;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
