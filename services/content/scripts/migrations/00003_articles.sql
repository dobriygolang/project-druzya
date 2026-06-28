-- +goose Up
-- +goose StatementBegin
CREATE TABLE articles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             TEXT NOT NULL UNIQUE,
    title            TEXT NOT NULL,
    summary          TEXT NOT NULL,
    body             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'draft',
    reading_minutes  INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT articles_status_check CHECK (
        status IN ('draft', 'published', 'archived')
    )
);

CREATE INDEX articles_status_updated_idx ON articles (status, updated_at DESC);

CREATE TABLE article_skill_keys (
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    skill_key  TEXT NOT NULL,
    PRIMARY KEY (article_id, skill_key)
);

CREATE INDEX article_skill_keys_skill_key_idx ON article_skill_keys (skill_key);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
