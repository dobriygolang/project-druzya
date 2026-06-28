-- +goose Up
-- +goose StatementBegin
INSERT INTO article_tasks (article_id, task_id, position)
VALUES
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 1),
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 2)
ON CONFLICT DO NOTHING;

INSERT INTO article_tasks (article_id, task_id, position)
VALUES
    ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 1)
ON CONFLICT DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
