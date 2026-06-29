-- +goose Up
-- +goose StatementBegin
ALTER TABLE epics ADD COLUMN hold_open BOOLEAN NOT NULL DEFAULT false;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE epics DROP COLUMN IF EXISTS hold_open;
-- +goose StatementEnd
