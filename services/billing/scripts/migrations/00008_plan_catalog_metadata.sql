-- +goose Up
-- +goose StatementBegin
UPDATE plans
SET metadata = jsonb_build_object(
        'tagline', 'Попробовать без оплаты',
        'highlight', false
    ),
    name = 'Free',
    updated_at = now()
WHERE slug = 'free';

UPDATE plans
SET metadata = jsonb_build_object(
        'tagline', 'Для плотной подготовки',
        'highlight', true
    ),
    name = 'Pro',
    updated_at = now()
WHERE slug = 'pro_monthly';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
UPDATE plans
SET metadata = '{}'::jsonb,
    name = 'Free',
    updated_at = now()
WHERE slug = 'free';

UPDATE plans
SET metadata = '{}'::jsonb,
    name = 'Pro Monthly',
    updated_at = now()
WHERE slug = 'pro_monthly';
-- +goose StatementEnd
