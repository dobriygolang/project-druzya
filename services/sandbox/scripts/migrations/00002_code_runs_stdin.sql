-- +goose Up
-- +goose StatementBegin
ALTER TABLE code_runs ADD COLUMN IF NOT EXISTS stdin TEXT NOT NULL DEFAULT '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE code_runs DROP COLUMN IF EXISTS stdin;
-- +goose StatementEnd
