-- +goose Up
-- +goose StatementBegin
ALTER TABLE user_skill_profiles
    ADD COLUMN IF NOT EXISTS profile_summary TEXT,
    ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE user_skill_profiles
    DROP COLUMN IF EXISTS summary_updated_at,
    DROP COLUMN IF EXISTS profile_summary;
-- +goose StatementEnd
