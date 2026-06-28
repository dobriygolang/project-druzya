-- +goose Up
ALTER TABLE code_rooms
    ADD COLUMN IF NOT EXISTS is_guest_created BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_code_rooms_guest_active
    ON code_rooms (expires_at)
    WHERE archived_at IS NULL AND is_guest_created = true;

-- +goose Down
DROP INDEX IF EXISTS idx_code_rooms_guest_active;
ALTER TABLE code_rooms DROP COLUMN IF EXISTS is_guest_created;
