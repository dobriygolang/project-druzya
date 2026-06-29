-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE focus_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    mode                TEXT NOT NULL DEFAULT 'pomodoro',
    pinned_title        TEXT NOT NULL DEFAULT '',
    task_id             UUID,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    seconds_focused     INT NOT NULL DEFAULT 0,
    pomodoros_completed INT NOT NULL DEFAULT 0
);

CREATE INDEX focus_sessions_user_started_idx ON focus_sessions (user_id, started_at DESC);

CREATE TABLE focus_streaks (
    user_id             UUID PRIMARY KEY,
    current_streak_days INT NOT NULL DEFAULT 0,
    longest_streak_days INT NOT NULL DEFAULT 0,
    last_active_date    DATE
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS focus_streaks;
DROP TABLE IF EXISTS focus_sessions;
-- +goose StatementEnd
