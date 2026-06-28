-- +goose Up
-- +goose StatementBegin
-- Free tier caps aligned with shared Groq/Cloudflare free quotas (~1000
-- heavy eval calls/day org-wide). 5 eval/user/day × 2 LLM hops ≈ 10 API
-- calls; ~100 active free users stay within provider limits.
UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":5,"period":"day"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'ai_evaluations_per_day';

UPDATE plan_entitlements
SET value_json = '{"type":"counter","limit":3,"period":"month"}'::jsonb,
    updated_at = now()
WHERE plan_id = 'f0000000-0000-4000-8000-000000000001'
  AND key = 'mock_interviews_per_month';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
