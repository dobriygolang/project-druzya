-- +goose Up
-- +goose StatementBegin
CREATE TABLE article_videos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id       UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    url              TEXT NOT NULL,
    provider         TEXT NOT NULL DEFAULT 'youtube',
    position         INT NOT NULL,
    duration_seconds INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT article_videos_provider_check CHECK (
        provider IN ('youtube', 'vimeo', 'other')
    ),
    CONSTRAINT article_videos_position_unique UNIQUE (article_id, position)
);

CREATE INDEX article_videos_article_id_idx ON article_videos (article_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
