-- +goose Up
-- +goose StatementBegin
-- Idempotent MVP catalog seed (fixed UUIDs). Safe to re-run via ON CONFLICT.

INSERT INTO companies (id, slug, name, description, is_active)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    'yandex',
    'Yandex',
    'Interview preparation track inspired by Yandex backend hiring.',
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO interview_templates (id, company_id, slug, title, description, target_role, target_level, passing_score, is_active)
VALUES (
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'yandex-backend-junior',
    'Yandex Backend — Junior',
    'Algorithms + behavioral screening for junior backend engineers.',
    'backend',
    'junior',
    85,
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO template_sections (id, template_id, section_type, title, description, position, passing_score)
VALUES
    (
        'a0000000-0000-4000-8000-000000000003',
        'a0000000-0000-4000-8000-000000000002',
        'algorithm',
        'Algorithms',
        'Classic data structures and complexity analysis.',
        1,
        85
    ),
    (
        'a0000000-0000-4000-8000-000000000004',
        'a0000000-0000-4000-8000-000000000002',
        'behavioral',
        'Behavioral',
        'Past experience, teamwork, and communication.',
        2,
        80
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, slug, type, title, description, difficulty, estimated_minutes, metadata, status)
VALUES
    (
        'b0000000-0000-4000-8000-000000000001',
        'two-sum',
        'algorithm',
        'Two Sum',
        'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution.',
        'easy',
        15,
        '{"constraints":["2 <= nums.length <= 10^4","Exactly one valid pair exists"],"hints":["Use a hash map to store seen values"]}'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000002',
        'valid-parentheses',
        'algorithm',
        'Valid Parentheses',
        'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.',
        'easy',
        15,
        '{"constraints":["1 <= s.length <= 10^4"],"hints":["Use a stack"]}'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000003',
        'merge-two-sorted-lists',
        'algorithm',
        'Merge Two Sorted Lists',
        'Merge two sorted linked lists and return the merged list sorted. Analyze time and space complexity.',
        'easy',
        20,
        '{"constraints":["Both lists are sorted in non-decreasing order"],"hints":["Iterate with a dummy head node"]}'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000004',
        'binary-search',
        'algorithm',
        'Binary Search',
        'Given a sorted array of integers nums and an integer target, return the index of target or -1 if not found. Explain why binary search works.',
        'easy',
        15,
        '{"constraints":["All values in nums are unique","Array is sorted ascending"],"hints":["Maintain left/right pointers"]}'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000005',
        'longest-substring-without-repeating',
        'algorithm',
        'Longest Substring Without Repeating Characters',
        'Given a string s, find the length of the longest substring without repeating characters.',
        'medium',
        25,
        '{"constraints":["0 <= s.length <= 5 * 10^4"],"hints":["Sliding window with last-seen index map"]}'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000006',
        'tell-me-about-yourself',
        'behavioral',
        'Tell Me About Yourself',
        'Give a concise professional introduction focused on backend engineering experience. Structure your answer for a technical interview.',
        'easy',
        10,
        '{"prompt":"Focus on relevant projects, stack, and motivation for backend roles."}'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000007',
        'conflict-with-teammate',
        'behavioral',
        'Conflict With a Teammate',
        'Describe a situation where you disagreed with a teammate. How did you resolve it and what was the outcome?',
        'medium',
        15,
        '{"prompt":"Use STAR: Situation, Task, Action, Result."}'::jsonb,
        'published'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_section_tasks (section_id, task_id, position)
VALUES
    ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 1),
    ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 2),
    ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 3),
    ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 4),
    ('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000005', 5),
    ('a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000006', 1),
    ('a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000007', 2)
ON CONFLICT DO NOTHING;

INSERT INTO task_solutions (id, task_id, language, solution_text, explanation, complexity, is_primary)
VALUES
    (
        'c0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001',
        'go',
        'func twoSum(nums []int, target int) []int {
    seen := make(map[int]int)
    for i, n := range nums {
        if j, ok := seen[target-n]; ok {
            return []int{j, i}
        }
        seen[n] = i
    }
    return nil
}',
        'Single pass with hash map. Time O(n), space O(n).',
        'O(n) time, O(n) space',
        true
    ),
    (
        'c0000000-0000-4000-8000-000000000002',
        'b0000000-0000-4000-8000-000000000002',
        'go',
        'func isValid(s string) bool {
    stack := []rune{}
    pairs := map[rune]rune{''('': '')'', ''['': '']'', ''{'': ''}''}
    for _, ch := range s {
        switch ch {
        case ''('', ''['', ''{'':
            stack = append(stack, ch)
        default:
            if len(stack) == 0 || pairs[stack[len(stack)-1]] != ch {
                return false
            }
            stack = stack[:len(stack)-1]
        }
    }
    return len(stack) == 0
}',
        'Stack matches closing brackets. Time O(n), space O(n).',
        'O(n) time, O(n) space',
        true
    ),
    (
        'c0000000-0000-4000-8000-000000000003',
        'b0000000-0000-4000-8000-000000000006',
        NULL,
        'I am a backend engineer with X years of experience building APIs and distributed services. Recently I worked on [project] using Go/PostgreSQL, where I [impact]. I am excited about this role because [motivation tied to company/product].',
        'Keep it under 2 minutes; end with why this team.',
        NULL,
        true
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO rubrics (id, task_type, title, version, is_active)
VALUES
    (
        'd0000000-0000-4000-8000-000000000001',
        'algorithm',
        'Algorithm Interview Rubric',
        1,
        true
    ),
    (
        'd0000000-0000-4000-8000-000000000002',
        'behavioral',
        'Behavioral Interview Rubric',
        1,
        true
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO rubric_criteria (id, rubric_id, key, title, description, weight, max_score, position)
VALUES
    (
        'e0000000-0000-4000-8000-000000000001',
        'd0000000-0000-4000-8000-000000000001',
        'correctness',
        'Correctness',
        'Solution solves the problem for typical and edge cases.',
        40,
        100,
        1
    ),
    (
        'e0000000-0000-4000-8000-000000000002',
        'd0000000-0000-4000-8000-000000000001',
        'complexity_analysis',
        'Complexity Analysis',
        'Candidate explains time and space complexity accurately.',
        30,
        100,
        2
    ),
    (
        'e0000000-0000-4000-8000-000000000003',
        'd0000000-0000-4000-8000-000000000001',
        'code_quality',
        'Code Quality',
        'Readable structure, naming, and reasonable tradeoffs.',
        30,
        100,
        3
    ),
    (
        'e0000000-0000-4000-8000-000000000004',
        'd0000000-0000-4000-8000-000000000002',
        'star_structure',
        'STAR Structure',
        'Answer follows Situation, Task, Action, Result.',
        50,
        100,
        1
    ),
    (
        'e0000000-0000-4000-8000-000000000005',
        'd0000000-0000-4000-8000-000000000002',
        'communication',
        'Communication',
        'Clear, concise, professional delivery.',
        50,
        100,
        2
    )
ON CONFLICT (id) DO NOTHING;

-- Sandbox metadata and editor_preset: see 00010_seed_catalog_excellence.sql

INSERT INTO rubrics (id, task_type, title, version, is_active)
VALUES (
    'd0000000-0000-4000-8000-000000000003',
    'live_coding',
    'Live Coding Rubric',
    1,
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO rubric_criteria (id, rubric_id, key, title, description, weight, max_score, position)
VALUES
    (
        'e0000000-0000-4000-8000-000000000006',
        'd0000000-0000-4000-8000-000000000003',
        'correctness',
        'Correctness',
        'Solution passes public and hidden test cases.',
        50,
        100,
        1
    ),
    (
        'e0000000-0000-4000-8000-000000000007',
        'd0000000-0000-4000-8000-000000000003',
        'complexity_analysis',
        'Complexity Analysis',
        'Candidate explains time and space complexity.',
        25,
        100,
        2
    ),
    (
        'e0000000-0000-4000-8000-000000000008',
        'd0000000-0000-4000-8000-000000000003',
        'code_quality',
        'Code Quality',
        'Readable structure, naming, and edge-case handling.',
        25,
        100,
        3
    )
ON CONFLICT (id) DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
