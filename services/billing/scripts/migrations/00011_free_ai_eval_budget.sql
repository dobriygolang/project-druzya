-- +goose Up
-- +goose StatementBegin
-- One mock session has several tasks; each attempt consumes one ai_evaluations_per_day.
-- 25/day lets a free user finish ~3 mocks worth of tasks on an active prep day.
UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":25,"period":"day"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'ai_evaluations_per_day';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
