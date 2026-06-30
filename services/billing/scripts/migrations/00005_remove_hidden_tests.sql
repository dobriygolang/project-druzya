-- +goose Up
-- +goose StatementBegin
DELETE FROM plan_entitlements WHERE key = 'hidden_tests_enabled';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
