-- +goose Up
-- +goose StatementBegin
-- Concurrent active live rooms — enforced by rooms-service; omit limit = unlimited (beta).
INSERT INTO plan_entitlements (plan_id, key, value_json) VALUES
    ('f0000000-0000-4000-8000-000000000001', 'live_rooms_concurrent', '{"type":"gauge"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'live_rooms_concurrent', '{"type":"gauge","limit":100}'::jsonb)
ON CONFLICT (plan_id, key) DO UPDATE
SET value_json = EXCLUDED.value_json, updated_at = now();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM plan_entitlements WHERE key = 'live_rooms_concurrent';
-- +goose StatementEnd
