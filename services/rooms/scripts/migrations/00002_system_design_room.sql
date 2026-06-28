-- +goose Up
ALTER TABLE code_rooms DROP CONSTRAINT code_rooms_type_check;
ALTER TABLE code_rooms ADD CONSTRAINT code_rooms_type_check CHECK (
    room_type IN ('practice', 'interview', 'pair_mock', 'system_design')
);

ALTER TABLE code_rooms DROP CONSTRAINT code_rooms_language_check;
ALTER TABLE code_rooms ADD CONSTRAINT code_rooms_language_check CHECK (
    language IN ('go', 'python', 'javascript', 'typescript', 'diagram')
);

-- +goose Down
ALTER TABLE code_rooms DROP CONSTRAINT code_rooms_type_check;
ALTER TABLE code_rooms ADD CONSTRAINT code_rooms_type_check CHECK (
    room_type IN ('practice', 'interview', 'pair_mock')
);

ALTER TABLE code_rooms DROP CONSTRAINT code_rooms_language_check;
ALTER TABLE code_rooms ADD CONSTRAINT code_rooms_language_check CHECK (
    language IN ('go', 'python', 'javascript', 'typescript', 'diagram')
);
