-- +goose Up
-- +goose StatementBegin
ALTER TABLE notes DROP COLUMN IF EXISTS folder_id;
DROP INDEX IF EXISTS notes_user_folder_idx;
DROP TABLE IF EXISTS note_folders;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE note_folders (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    name       TEXT NOT NULL,
    parent_id  UUID REFERENCES note_folders (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX note_folders_user_idx ON note_folders (user_id);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES note_folders (id) ON DELETE SET NULL;

CREATE INDEX notes_user_folder_idx ON notes (user_id, folder_id);
-- +goose StatementEnd
