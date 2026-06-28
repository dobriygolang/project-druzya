-- +goose Up
-- +goose StatementBegin
CREATE TABLE user_task_progress (
    user_id         UUID NOT NULL,
    task_id         UUID NOT NULL,
    task_type       TEXT NOT NULL,
    best_score      INT NOT NULL DEFAULT 0,
    passed          BOOL NOT NULL DEFAULT false,
    attempts_count  INT NOT NULL DEFAULT 0,
    first_passed_at TIMESTAMPTZ,
    last_passed_at  TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, task_id)
);

CREATE INDEX user_task_progress_user_type_passed_idx
    ON user_task_progress (user_id, task_type, passed);

CREATE INDEX user_task_progress_user_type_last_passed_idx
    ON user_task_progress (user_id, task_type, last_passed_at)
    WHERE passed = true;

CREATE TABLE user_template_progress (
    user_id           UUID NOT NULL,
    template_id       UUID NOT NULL,
    best_total_score  INT NOT NULL DEFAULT 0,
    passed            BOOL NOT NULL DEFAULT false,
    attempts_count    INT NOT NULL DEFAULT 0,
    last_passed_at    TIMESTAMPTZ,
    last_session_id   UUID,
    last_attempt_at   TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, template_id)
);

CREATE INDEX user_template_progress_user_id_idx
    ON user_template_progress (user_id);

CREATE TABLE user_practice_mode_activity (
    user_id             UUID NOT NULL,
    session_mode        TEXT NOT NULL,
    task_type           TEXT NOT NULL DEFAULT '',
    last_practiced_at   TIMESTAMPTZ NOT NULL,
    passed_tasks_count  INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, session_mode)
);

CREATE INDEX user_practice_mode_activity_user_id_idx
    ON user_practice_mode_activity (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
