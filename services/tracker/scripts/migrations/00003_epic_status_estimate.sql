-- +goose Up
-- +goose StatementBegin
ALTER TABLE epics
    ADD COLUMN status TEXT NOT NULL DEFAULT 'open',
    ADD COLUMN completed_at TIMESTAMPTZ;

ALTER TABLE tasks
    ADD COLUMN estimate_days REAL NOT NULL DEFAULT 1;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_estimate_days_range CHECK (estimate_days >= 0.5 AND estimate_days <= 5);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_estimate_days_range;
ALTER TABLE tasks DROP COLUMN IF EXISTS estimate_days;
ALTER TABLE epics DROP COLUMN IF EXISTS completed_at;
ALTER TABLE epics DROP COLUMN IF EXISTS status;
-- +goose StatementEnd
