-- +goose Up
-- +goose StatementBegin
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY,
    smart_parse_enabled BOOLEAN NOT NULL DEFAULT false,
    google_calendar_sync_enabled BOOLEAN NOT NULL DEFAULT false,
    google_refresh_token TEXT,
    google_oauth_state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS user_settings;
-- +goose StatementEnd
