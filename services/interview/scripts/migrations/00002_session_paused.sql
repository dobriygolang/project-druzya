-- +goose Up
-- +goose StatementBegin
ALTER TABLE interview_sessions DROP CONSTRAINT interview_sessions_status_check;
ALTER TABLE interview_sessions ADD CONSTRAINT interview_sessions_status_check CHECK (
    status IN ('active', 'completed', 'cancelled', 'expired', 'paused')
);

DROP INDEX IF EXISTS interview_sessions_one_active_per_user_idx;
CREATE UNIQUE INDEX interview_sessions_one_ongoing_per_user_idx
    ON interview_sessions (user_id) WHERE status IN ('active', 'paused');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS interview_sessions_one_ongoing_per_user_idx;
CREATE UNIQUE INDEX interview_sessions_one_active_per_user_idx
    ON interview_sessions (user_id) WHERE status = 'active';

ALTER TABLE interview_sessions DROP CONSTRAINT interview_sessions_status_check;
ALTER TABLE interview_sessions ADD CONSTRAINT interview_sessions_status_check CHECK (
    status IN ('active', 'completed', 'cancelled', 'expired')
);
-- +goose StatementEnd
