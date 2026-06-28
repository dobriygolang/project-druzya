-- +goose Up
-- +goose StatementBegin
-- Free tier: allow company mock interviews; monthly quota (mock_interviews_per_month) still applies.
UPDATE plan_entitlements
SET value_json = '{"type":"bool","value":true}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'company_templates_enabled';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE plan_entitlements
SET value_json = '{"type":"bool","value":false}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'company_templates_enabled';
-- +goose StatementEnd
