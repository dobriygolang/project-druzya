-- +goose Up
-- +goose StatementBegin

CREATE INDEX IF NOT EXISTS recommendations_user_status_idx
    ON recommendations (user_id, status);

CREATE INDEX IF NOT EXISTS learning_plan_items_user_status_idx
    ON learning_plan_items (user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS recommendations_take_mock_active_uniq
    ON recommendations (user_id, type)
    WHERE status = 'active' AND type = 'take_mock_interview';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS recommendations_take_mock_active_uniq;
DROP INDEX IF EXISTS learning_plan_items_user_status_idx;
DROP INDEX IF EXISTS recommendations_user_status_idx;

-- +goose StatementEnd
