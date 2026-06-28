-- +goose Up
-- +goose StatementBegin
INSERT INTO article_videos (article_id, title, url, provider, position, duration_seconds)
VALUES (
    'c0000000-0000-4000-8000-000000000001',
    'Two pointers pattern (NeetCode)',
    'https://www.youtube.com/watch?v=cQ1Oz4ckceM',
    'youtube',
    1,
    720
) ON CONFLICT DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
