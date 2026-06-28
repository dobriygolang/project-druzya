-- +goose Up
ALTER TABLE interview_sessions
    ADD COLUMN outcome TEXT CHECK (outcome IS NULL OR outcome IN ('passed', 'failed'));

-- +goose Down
ALTER TABLE interview_sessions DROP COLUMN IF EXISTS outcome;
