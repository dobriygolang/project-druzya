-- +goose Up
-- +goose StatementBegin
INSERT INTO plan_entitlements (plan_id, key, value_json) VALUES
    ('f0000000-0000-4000-8000-000000000001', 'live_rooms_per_month', '{"type":"counter","limit":5,"period":"month"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'live_rooms_per_month', '{"type":"counter","period":"month"}'::jsonb)
ON CONFLICT (plan_id, key) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM plan_entitlements WHERE key = 'live_rooms_per_month';
-- +goose StatementEnd
