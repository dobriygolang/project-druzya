-- +goose Up
-- +goose StatementBegin
-- One mock session has several tasks; each attempt consumes one ai_evaluations
-- quota. 25/day allows ~3 mocks × ~8 tasks on a heavy prep day (free tier).
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
