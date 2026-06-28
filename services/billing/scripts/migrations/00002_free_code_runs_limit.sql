-- +goose Up
-- +goose StatementBegin
UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":50,"period":"day"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'code_runs_per_day';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE plan_entitlements
SET value_json = '{"type":"counter","period":"day"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'code_runs_per_day';
-- +goose StatementEnd
