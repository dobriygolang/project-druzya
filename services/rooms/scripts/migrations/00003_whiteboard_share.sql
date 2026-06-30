-- +goose Up
ALTER TABLE code_rooms ADD COLUMN IF NOT EXISTS initial_scene_json TEXT;

CREATE TABLE IF NOT EXISTS published_boards (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL DEFAULT '',
    scene_json    TEXT NOT NULL,
    published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS published_boards_slug_idx
    ON published_boards (slug) WHERE archived_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS published_boards;
ALTER TABLE code_rooms DROP COLUMN IF EXISTS initial_scene_json;
