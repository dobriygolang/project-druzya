-- +goose Up
-- +goose StatementBegin
DROP INDEX IF EXISTS code_runs_task_created_idx;
DROP INDEX IF EXISTS code_runs_session_task_created_idx;
ALTER TABLE code_runs DROP COLUMN IF EXISTS task_id;
ALTER TABLE code_runs DROP COLUMN IF EXISTS session_task_id;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
