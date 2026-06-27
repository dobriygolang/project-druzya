-- +goose Up
-- +goose StatementBegin
CREATE UNIQUE INDEX retry_items_user_task_active_idx
    ON retry_items (user_id, task_id)
    WHERE status IN ('pending', 'in_progress');

DROP INDEX IF EXISTS evaluation_summaries_attempt_id_idx;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE INDEX evaluation_summaries_attempt_id_idx ON evaluation_summaries (attempt_id);
DROP INDEX IF EXISTS retry_items_user_task_active_idx;
-- +goose StatementEnd
