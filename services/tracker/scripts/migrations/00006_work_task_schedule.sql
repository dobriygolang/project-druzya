-- +goose Up
-- +goose StatementBegin
ALTER TABLE tasks
    ADD COLUMN board_status TEXT NOT NULL DEFAULT 'todo',
    ADD COLUMN scheduled_start TIMESTAMPTZ,
    ADD COLUMN scheduled_duration_min INT,
    ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX idx_tasks_user_board ON tasks (sprint_id, board_status)
    WHERE archived_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE tasks
    DROP COLUMN IF EXISTS archived_at,
    DROP COLUMN IF EXISTS scheduled_duration_min,
    DROP COLUMN IF EXISTS scheduled_start,
    DROP COLUMN IF EXISTS board_status;
-- +goose StatementEnd
