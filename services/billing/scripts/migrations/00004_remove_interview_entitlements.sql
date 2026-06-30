-- +goose Up
-- +goose StatementBegin
DELETE FROM plan_entitlements
WHERE key IN (
    'company_templates_enabled',
    'recommendations_enabled',
    'advanced_feedback_enabled',
    'sd_ai_turns_per_month'
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
