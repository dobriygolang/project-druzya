-- +goose Up
-- +goose StatementBegin
ALTER TABLE session_tasks
    ADD COLUMN task_title TEXT,
    ADD COLUMN task_type TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
