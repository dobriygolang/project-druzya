-- +goose Up
-- +goose StatementBegin
-- Productivity entitlements for Hone (notes, focus, live rooms). Tighten free live-room caps.
INSERT INTO plan_entitlements (plan_id, key, value_json) VALUES
    ('f0000000-0000-4000-8000-000000000001', 'cloud_notes_count', '{"type":"gauge","limit":10}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'ai_insights_per_day', '{"type":"counter","limit":5,"period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'live_rooms_per_month', '{"type":"counter","limit":5,"period":"month"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000001', 'live_rooms_concurrent', '{"type":"gauge","limit":1}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'cloud_notes_count', '{"type":"gauge"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'ai_insights_per_day', '{"type":"counter","limit":50,"period":"day"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'live_rooms_per_month', '{"type":"counter","limit":30,"period":"month"}'::jsonb),
    ('f0000000-0000-4000-8000-000000000002', 'live_rooms_concurrent', '{"type":"gauge","limit":5}'::jsonb)
ON CONFLICT (plan_id, key) DO UPDATE SET
    value_json = EXCLUDED.value_json,
    updated_at = now();

UPDATE plans
SET metadata = '{"tagline":"Для ежедневной продуктивности","highlight":false}'::jsonb,
    updated_at = now()
WHERE slug = 'free';

UPDATE plans
SET metadata = '{"tagline":"Без лимитов на фокус и заметки","highlight":true}'::jsonb,
    updated_at = now()
WHERE slug = 'pro_monthly';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
