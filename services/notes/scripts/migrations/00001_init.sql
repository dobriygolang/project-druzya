-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE vault_salts (
    user_id    UUID PRIMARY KEY,
    salt       BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE note_folders (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    name       TEXT NOT NULL,
    parent_id  UUID REFERENCES note_folders (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX note_folders_user_idx ON note_folders (user_id);

CREATE TABLE notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    folder_id     UUID REFERENCES note_folders (id) ON DELETE SET NULL,
    title         TEXT NOT NULL DEFAULT '',
    body_md       TEXT NOT NULL DEFAULT '',
    encrypted     BOOLEAN NOT NULL DEFAULT false,
    published     BOOLEAN NOT NULL DEFAULT false,
    publish_slug  TEXT,
    published_at  TIMESTAMPTZ,
    size_bytes    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at   TIMESTAMPTZ
);

CREATE INDEX notes_user_updated_idx ON notes (user_id, updated_at DESC);
CREATE INDEX notes_user_folder_idx ON notes (user_id, folder_id);
CREATE UNIQUE INDEX notes_publish_slug_idx ON notes (publish_slug) WHERE publish_slug IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS note_folders;
DROP TABLE IF EXISTS vault_salts;
-- +goose StatementEnd
