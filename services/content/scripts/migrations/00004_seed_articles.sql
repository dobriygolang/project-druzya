-- +goose Up
-- +goose StatementBegin
INSERT INTO articles (id, slug, title, summary, body, status, reading_minutes)
VALUES (
    'c0000000-0000-4000-8000-000000000001',
    'arrays-and-two-pointers',
    'Arrays & two pointers',
    'How to recognize array patterns and use two pointers to avoid extra memory.',
    E'## When to use two pointers\n\nMany array problems ask for a pair of indices or a subarray with a property. If the input can be scanned from both ends (sorted array, palindrome, container with two boundaries), two pointers often give O(n) time and O(1) extra space.\n\n## Checklist before coding\n\n1. Can you sort or is the array already sorted?\n2. Do you need all pairs or only one optimal pair?\n3. Can you move the left or right pointer based on a comparison?\n\n## Practice link\n\nAfter reading, retry failed array tasks from Today — the brief will suggest concrete tasks.',
    'published',
    6
) ON CONFLICT (id) DO NOTHING;

INSERT INTO article_skill_keys (article_id, skill_key)
VALUES
    ('c0000000-0000-4000-8000-000000000001', 'algorithm.arrays'),
    ('c0000000-0000-4000-8000-000000000001', 'algorithm.correctness')
ON CONFLICT DO NOTHING;

INSERT INTO articles (id, slug, title, summary, body, status, reading_minutes)
VALUES (
    'c0000000-0000-4000-8000-000000000002',
    'behavioral-star-framework',
    'Behavioral answers with STAR',
    'Structure situational answers so interviewers hear impact, not rambling.',
    E'## STAR in one minute\n\n- **Situation** — one sentence of context.\n- **Task** — your responsibility.\n- **Action** — what you did (use "I", be specific).\n- **Result** — measurable outcome or lesson.\n\n## Common mistake\n\nJumping to Action without Situation. The interviewer cannot score ownership and impact.\n\n## Next step\n\nRewrite a weak behavioral attempt using STAR, then run a short behavioral mock.',
    'published',
    5
) ON CONFLICT (id) DO NOTHING;

INSERT INTO article_skill_keys (article_id, skill_key)
VALUES
    ('c0000000-0000-4000-8000-000000000002', 'behavioral.overall')
ON CONFLICT DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
