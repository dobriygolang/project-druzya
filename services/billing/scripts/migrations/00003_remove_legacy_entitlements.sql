-- +goose Up
-- +goose StatementBegin
-- Retired interview/AI insight entitlements (services removed from prod).
DELETE FROM plan_entitlements
WHERE key IN (
    'mock_interviews_per_month',
    'ai_evaluations_per_day',
    'ai_insights_per_day'
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
