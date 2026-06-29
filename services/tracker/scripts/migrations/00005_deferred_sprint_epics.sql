-- +goose Up
ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS deferred_sprint_epic_names TEXT[] NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE user_settings DROP COLUMN IF EXISTS deferred_sprint_epic_names;
