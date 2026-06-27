-- +goose Up
-- +goose StatementBegin

CREATE UNIQUE INDEX IF NOT EXISTS recommendations_special_active_uniq
    ON recommendations (user_id, type, skill_key)
    WHERE status = 'active' AND type IN ('rewrite_answer', 'practice_section');

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS recommendations_special_active_uniq;

-- +goose StatementEnd
