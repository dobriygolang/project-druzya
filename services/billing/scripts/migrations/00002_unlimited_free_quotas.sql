-- +goose Up
-- +goose StatementBegin
UPDATE plans
SET
    description = 'Full free — unlimited quotas',
    metadata = jsonb_set(metadata, '{tagline}', '"Всё без лимитов"'::jsonb),
    updated_at = now()
WHERE slug = 'free';

UPDATE plan_entitlements
SET value_json = '{"type":"counter","period":"day"}'::jsonb, updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001' AND key = 'code_runs_per_day';

UPDATE plan_entitlements
SET value_json = '{"type":"gauge"}'::jsonb, updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001' AND key = 'cloud_notes_count';

UPDATE plan_entitlements
SET value_json = '{"type":"counter","period":"month"}'::jsonb, updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001' AND key = 'live_rooms_per_month';

UPDATE plan_entitlements
SET value_json = '{"type":"gauge"}'::jsonb, updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001' AND key = 'live_rooms_concurrent';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
