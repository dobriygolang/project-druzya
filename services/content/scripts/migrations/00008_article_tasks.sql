-- +goose Up
-- +goose StatementBegin
CREATE TABLE article_tasks (
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    position   INT NOT NULL,
    PRIMARY KEY (article_id, task_id),
    CONSTRAINT article_tasks_position_unique UNIQUE (article_id, position)
);

CREATE INDEX article_tasks_task_id_idx ON article_tasks (task_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
