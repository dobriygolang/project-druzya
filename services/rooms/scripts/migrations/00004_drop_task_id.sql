-- +goose Up
-- +goose StatementBegin
ALTER TABLE code_rooms DROP COLUMN IF EXISTS task_id;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
