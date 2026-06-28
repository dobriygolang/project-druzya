-- +goose Up
-- +goose StatementBegin
-- Live coding rooms (ported from druzya editor_rooms + editor_participants).

CREATE TABLE IF NOT EXISTS code_rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL,
    room_type   TEXT NOT NULL DEFAULT 'interview',
    task_id     UUID,
    language    TEXT NOT NULL DEFAULT 'go',
    is_frozen   BOOLEAN NOT NULL DEFAULT false,
    visibility  TEXT NOT NULL DEFAULT 'shared',
    is_guest_created  BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT code_rooms_type_check CHECK (room_type IN ('practice', 'interview', 'pair_mock')),
    CONSTRAINT code_rooms_visibility_check CHECK (visibility IN ('private', 'shared')),
    CONSTRAINT code_rooms_language_check CHECK (language IN ('go', 'python', 'javascript', 'typescript'))
);

CREATE INDEX IF NOT EXISTS idx_code_rooms_owner ON code_rooms (owner_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_code_rooms_expires ON code_rooms (expires_at) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS code_room_participants (
    room_id    UUID NOT NULL REFERENCES code_rooms (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    role       TEXT NOT NULL,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id),
    CONSTRAINT code_room_participants_role_check CHECK (
        role IN ('owner', 'interviewer', 'participant', 'viewer')
    )
);

CREATE INDEX IF NOT EXISTS idx_code_room_participants_user ON code_room_participants (user_id);

CREATE INDEX idx_code_rooms_guest_active
    ON code_rooms (expires_at)
    WHERE archived_at IS NULL AND is_guest_created = true;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
