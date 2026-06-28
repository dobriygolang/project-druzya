-- +goose Up
-- +goose StatementBegin
-- TEMP: unlimited free-tier counters while product is in beta.
UPDATE plan_entitlements
SET value_json = '{"type":"counter","period":"day"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key IN ('ai_evaluations_per_day', 'code_runs_per_day');

UPDATE plan_entitlements
SET value_json = '{"type":"counter","period":"month"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key IN ('mock_interviews_per_month', 'live_rooms_per_month');
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":5,"period":"day"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'ai_evaluations_per_day';

UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":2,"period":"month"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'mock_interviews_per_month';

UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":30,"period":"day"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'code_runs_per_day';

UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":5,"period":"month"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'live_rooms_per_month';
-- +goose StatementEnd
