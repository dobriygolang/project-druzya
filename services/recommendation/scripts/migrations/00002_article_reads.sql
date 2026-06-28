-- +goose Up
-- +goose StatementBegin
CREATE TABLE article_reads (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    article_slug TEXT NOT NULL,
    read_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, article_slug)
);

CREATE INDEX article_reads_user_id_idx ON article_reads (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
