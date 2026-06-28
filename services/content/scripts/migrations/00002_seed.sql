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

-- Canonical catalog: algorithm tasks (sandbox + editor_preset), live_coding (sandbox + AI-only),
-- system_design, expanded company templates.

-- ── 1. Algorithm track (solo algo + Yandex template section) ─────────────────

UPDATE tasks SET
    type = 'algorithm',
    metadata = '{
        "execution": "sandbox",
        "constraints": ["2 <= nums.length <= 10^4", "Exactly one valid pair exists"],
        "hints": ["Use a hash map to store seen values"],
        "editor_preset": {
            "go": {
                "solution": "func twoSum(nums []int, target int) []int {\n\t// Write your solution here\n\treturn nil\n}",
                "harness": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n)\n\n{{SOLUTION}}\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\tnums := strings.Fields(scanner.Text())\n\tscanner.Scan()\n\ttarget, _ := strconv.Atoi(strings.TrimSpace(scanner.Text()))\n\tarr := make([]int, len(nums))\n\tfor i, raw := range nums {\n\t\tarr[i], _ = strconv.Atoi(raw)\n\t}\n\tresult := twoSum(arr, target)\n\tfmt.Printf(\"%d %d\\n\", result[0], result[1])\n}"
            },
            "python": {
                "solution": "def two_sum(nums, target):\n    # Write your solution here\n    return []",
                "harness": "import sys\n\n{{SOLUTION}}\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    nums = list(map(int, lines[0].split()))\n    target = int(lines[1])\n    i, j = two_sum(nums, target)\n    print(i, j)\n\nif __name__ == \"__main__\":\n    main()"
            },
            "javascript": {
                "solution": "function twoSum(nums, target) {\n  // Write your solution here\n  return [];\n}",
                "harness": "const fs = require(''fs'');\n\n{{SOLUTION}}\n\nfunction main() {\n  const lines = fs.readFileSync(0, ''utf8'').trim().split(''\\n'');\n  const nums = lines[0].split('' '').map(Number);\n  const target = Number(lines[1]);\n  const [i, j] = twoSum(nums, target);\n  console.log(`${i} ${j}`);\n}\n\nmain();\n"
            }
        },
        "examples": [
            {"name": "example 1", "input": "2 7 11 15\n9\n", "expected_output": "0 1", "explanation": "nums[0] + nums[1] == 9"}
        ],
        "test_cases": [
            {"name": "basic", "input": "2 7 11 15\n9\n", "expected_output": "0 1"},
            {"name": "second pair", "input": "3 2 4\n6\n", "expected_output": "1 2"}
        ],
        "hidden_test_cases": [
            {"name": "duplicate values", "input": "3 3\n6\n", "expected_output": "0 1", "is_hidden": true}
        ],
        "limits": {"timeout_ms": 2000, "memory_mb": 128}
    }'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000001';

UPDATE tasks SET
    type = 'algorithm',
    metadata = '{
        "execution": "sandbox",
        "constraints": ["1 <= s.length <= 10^4"],
        "hints": ["Use a stack"],
        "editor_preset": {
            "go": {
                "solution": "func isValid(s string) bool {\n\t// Write your solution here\n\treturn false\n}",
                "harness": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n)\n\n{{SOLUTION}}\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\tfmt.Println(isValid(scanner.Text()))\n}"
            },
            "python": {
                "solution": "def is_valid(s):\n    # Write your solution here\n    return False",
                "harness": "import sys\n\n{{SOLUTION}}\n\ndef main():\n    s = sys.stdin.readline().strip()\n    print(str(is_valid(s)).lower())\n\nif __name__ == \"__main__\":\n    main()"
            },
            "javascript": {
                "solution": "function isValid(s) {\n  // Write your solution here\n  return false;\n}",
                "harness": "const fs = require(''fs'');\n\n{{SOLUTION}}\n\nfunction main() {\n  const s = fs.readFileSync(0, ''utf8'').trim();\n  console.log(String(isValid(s)));\n}\n\nmain();\n"
            }
        },
        "examples": [
            {"name": "valid", "input": "()[]{}", "expected_output": "true"},
            {"name": "invalid", "input": "(]", "expected_output": "false"}
        ],
        "test_cases": [
            {"name": "simple valid", "input": "()", "expected_output": "true"},
            {"name": "nested valid", "input": "{[]}", "expected_output": "true"},
            {"name": "mismatch", "input": "(]", "expected_output": "false"}
        ],
        "hidden_test_cases": [
            {"name": "only open", "input": "(((", "expected_output": "false", "is_hidden": true}
        ],
        "limits": {"timeout_ms": 2000, "memory_mb": 128}
    }'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000002';

UPDATE tasks SET
    type = 'algorithm',
    metadata = '{
        "execution": "sandbox",
        "constraints": ["Both lists are sorted in non-decreasing order"],
        "hints": ["Iterate with a dummy head node"],
        "editor_preset": {
            "go": {
                "solution": "func merge(a, b []int) []int {\n\t// Write your solution here\n\treturn nil\n}",
                "harness": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n)\n\n{{SOLUTION}}\n\nfunc parseInts(s string) []int {\n\tparts := strings.Fields(s)\n\tout := make([]int, len(parts))\n\tfor i, p := range parts {\n\t\tout[i], _ = strconv.Atoi(p)\n\t}\n\treturn out\n}\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\ta := parseInts(scanner.Text())\n\tscanner.Scan()\n\tb := parseInts(scanner.Text())\n\tresult := merge(a, b)\n\tfor i, v := range result {\n\t\tif i > 0 {\n\t\t\tfmt.Print(\" \")\n\t\t}\n\t\tfmt.Print(v)\n\t}\n\tfmt.Println()\n}"
            },
            "python": {
                "solution": "def merge(a, b):\n    # Write your solution here\n    return []",
                "harness": "import sys\n\n{{SOLUTION}}\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    a = list(map(int, lines[0].split())) if lines[0].strip() else []\n    b = list(map(int, lines[1].split())) if len(lines) > 1 and lines[1].strip() else []\n    print('' ''.join(map(str, merge(a, b))))\n\nif __name__ == \"__main__\":\n    main()"
            },
            "javascript": {
                "solution": "function merge(a, b) {\n  // Write your solution here\n  return [];\n}",
                "harness": "const fs = require(''fs'');\n\n{{SOLUTION}}\n\nfunction main() {\n  const lines = fs.readFileSync(0, ''utf8'').trim().split(''\\n'');\n  const a = lines[0] ? lines[0].split('' '').map(Number) : [];\n  const b = lines[1] ? lines[1].split('' '').map(Number) : [];\n  console.log(merge(a, b).join('' ''));\n}\n\nmain();\n"
            }
        },
        "examples": [
            {"name": "example", "input": "1 2 4\n1 3 4", "expected_output": "1 1 2 3 4 4"}
        ],
        "test_cases": [
            {"name": "both non-empty", "input": "1 2 4\n1 3 4", "expected_output": "1 1 2 3 4 4"},
            {"name": "one empty", "input": "\n0", "expected_output": "0"}
        ],
        "hidden_test_cases": [
            {"name": "both empty", "input": "\n", "expected_output": "", "is_hidden": true}
        ],
        "limits": {"timeout_ms": 2000, "memory_mb": 128}
    }'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000003';

UPDATE tasks SET
    type = 'algorithm',
    metadata = '{
        "execution": "sandbox",
        "constraints": ["All values in nums are unique", "Array is sorted ascending"],
        "hints": ["Maintain left/right pointers"],
        "editor_preset": {
            "go": {
                "solution": "func search(nums []int, target int) int {\n\t// Write your solution here\n\treturn -1\n}",
                "harness": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n)\n\n{{SOLUTION}}\n\nfunc parseInts(s string) []int {\n\tparts := strings.Fields(s)\n\tout := make([]int, len(parts))\n\tfor i, p := range parts {\n\t\tout[i], _ = strconv.Atoi(p)\n\t}\n\treturn out\n}\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\tn, _ := strconv.Atoi(scanner.Text())\n\tscanner.Scan()\n\tnums := parseInts(scanner.Text())[:n]\n\tscanner.Scan()\n\ttarget, _ := strconv.Atoi(scanner.Text())\n\tfmt.Println(search(nums, target))\n}"
            },
            "python": {
                "solution": "def search(nums, target):\n    # Write your solution here\n    return -1",
                "harness": "import sys\n\n{{SOLUTION}}\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    n = int(lines[0])\n    nums = list(map(int, lines[1].split()))[:n]\n    target = int(lines[2])\n    print(search(nums, target))\n\nif __name__ == \"__main__\":\n    main()"
            },
            "javascript": {
                "solution": "function search(nums, target) {\n  // Write your solution here\n  return -1;\n}",
                "harness": "const fs = require(''fs'');\n\n{{SOLUTION}}\n\nfunction main() {\n  const lines = fs.readFileSync(0, ''utf8'').trim().split(''\\n'');\n  const n = Number(lines[0]);\n  const nums = lines[1].split('' '').map(Number).slice(0, n);\n  const target = Number(lines[2]);\n  console.log(search(nums, target));\n}\n\nmain();\n"
            }
        },
        "examples": [
            {"name": "found", "input": "5\n-1 0 3 5 9\n3", "expected_output": "2"},
            {"name": "missing", "input": "4\n-1 0 3 5\n2", "expected_output": "-1"}
        ],
        "test_cases": [
            {"name": "middle hit", "input": "5\n-1 0 3 5 9\n3", "expected_output": "2"},
            {"name": "not found", "input": "4\n-1 0 3 5\n2", "expected_output": "-1"}
        ],
        "hidden_test_cases": [
            {"name": "first element", "input": "3\n1 2 3\n1", "expected_output": "0", "is_hidden": true}
        ],
        "limits": {"timeout_ms": 2000, "memory_mb": 128}
    }'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000004';

UPDATE tasks SET
    type = 'algorithm',
    metadata = '{
        "execution": "sandbox",
        "constraints": ["0 <= s.length <= 5 * 10^4"],
        "hints": ["Sliding window with last-seen index map"],
        "editor_preset": {
            "go": {
                "solution": "func lengthOfLongestSubstring(s string) int {\n\t// Write your solution here\n\treturn 0\n}",
                "harness": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n)\n\n{{SOLUTION}}\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\tfmt.Println(lengthOfLongestSubstring(scanner.Text()))\n}"
            },
            "python": {
                "solution": "def length_of_longest_substring(s):\n    # Write your solution here\n    return 0",
                "harness": "import sys\n\n{{SOLUTION}}\n\ndef main():\n    s = sys.stdin.readline().strip()\n    print(length_of_longest_substring(s))\n\nif __name__ == \"__main__\":\n    main()"
            },
            "javascript": {
                "solution": "function lengthOfLongestSubstring(s) {\n  // Write your solution here\n  return 0;\n}",
                "harness": "const fs = require(''fs'');\n\n{{SOLUTION}}\n\nfunction main() {\n  const s = fs.readFileSync(0, ''utf8'').trim();\n  console.log(lengthOfLongestSubstring(s));\n}\n\nmain();\n"
            }
        },
        "examples": [
            {"name": "example", "input": "abcabcbb", "expected_output": "3"}
        ],
        "test_cases": [
            {"name": "classic", "input": "abcabcbb", "expected_output": "3"},
            {"name": "single char repeat", "input": "bbbbb", "expected_output": "1"}
        ],
        "hidden_test_cases": [
            {"name": "empty", "input": "", "expected_output": "0", "is_hidden": true}
        ],
        "limits": {"timeout_ms": 2000, "memory_mb": 128}
    }'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000005';

-- ── 2. Live coding track (sandbox + AI-only abstract tasks) ───────────────────

INSERT INTO tasks (id, slug, type, title, description, difficulty, estimated_minutes, metadata, status)
VALUES
    (
        'b0000000-0000-4000-8000-000000000008',
        'lc-cache-get-set',
        'live_coding',
        'In-Memory Cache Get/Set',
        'Implement an in-memory key-value cache with get and set. get returns empty string for missing keys. Input: one operation per line — SET key value or GET key. Output result of each GET on its own line.',
        'medium',
        25,
        '{
            "execution": "sandbox",
            "hints": ["Use a map[string]string", "Trim input lines"],
            "editor_preset": {
                "go": {
                    "solution": "type Cache struct {\n\tdata map[string]string\n}\n\nfunc NewCache() *Cache {\n\treturn &Cache{data: make(map[string]string)}\n}\n\nfunc (c *Cache) Set(key, value string) {\n\t// Write your solution here\n}\n\nfunc (c *Cache) Get(key string) string {\n\t// Write your solution here\n\treturn \"\"\n}",
                    "harness": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strings\"\n)\n\n{{SOLUTION}}\n\nfunc main() {\n\tcache := NewCache()\n\tscanner := bufio.NewScanner(os.Stdin)\n\tfor scanner.Scan() {\n\t\tline := strings.TrimSpace(scanner.Text())\n\t\tif line == \"\" {\n\t\t\tcontinue\n\t\t}\n\t\tparts := strings.SplitN(line, \" \", 3)\n\t\tswitch parts[0] {\n\t\tcase \"SET\":\n\t\t\tcache.Set(parts[1], parts[2])\n\t\tcase \"GET\":\n\t\t\tfmt.Println(cache.Get(parts[1]))\n\t\t}\n\t}\n}"
                },
                "python": {
                    "solution": "class Cache:\n    def __init__(self):\n        self.data = {}\n\n    def set(self, key, value):\n        # Write your solution here\n        pass\n\n    def get(self, key):\n        # Write your solution here\n        return \"\"",
                    "harness": "import sys\n\n{{SOLUTION}}\n\ndef main():\n    cache = Cache()\n    for line in sys.stdin.read().splitlines():\n        line = line.strip()\n        if not line:\n            continue\n        parts = line.split(\" \", 2)\n        if parts[0] == \"SET\":\n            cache.set(parts[1], parts[2])\n        elif parts[0] == \"GET\":\n            print(cache.get(parts[1]))\n\nif __name__ == \"__main__\":\n    main()"
                }
            },
            "examples": [
                {"name": "set and get", "input": "SET user 42\nGET user\nGET missing", "expected_output": "42\n"}
            ],
            "test_cases": [
                {"name": "basic", "input": "SET a hello\nGET a\nGET b", "expected_output": "hello\n"},
                {"name": "overwrite", "input": "SET k 1\nSET k 2\nGET k", "expected_output": "2"}
            ],
            "hidden_test_cases": [
                {"name": "empty value", "input": "SET k \nGET k", "expected_output": "", "is_hidden": true}
            ],
            "limits": {"timeout_ms": 2000, "memory_mb": 128}
        }'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000009',
        'lc-code-review-map-mutation',
        'live_coding',
        'Code Review: Shared Map Mutation',
        'Review the Go snippet in the editor. It is used from multiple HTTP handlers concurrently. Explain the bug, how to reproduce it, and how you would fix it. No automated tests — submit your review for AI grading.',
        'medium',
        20,
        '{
            "execution": "none",
            "prompt": "Focus on data races, map concurrency rules in Go, and concrete fix options (sync.RWMutex, sharded maps, sync.Map).",
            "editor_preset": {
                "go": {
                    "solution": "import (\n\t\"fmt\"\n\t\"net/http\"\n)\n\nvar store = map[string]int{}\n\nfunc Handle(w http.ResponseWriter, r *http.Request) {\n\tkey := r.URL.Query().Get(\"key\")\n\tstore[key]++\n\tfmt.Fprintf(w, \"%d\", store[key])\n}\n"
                }
            }
        }'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000010',
        'lc-predict-output-closure',
        'live_coding',
        'What Will This Print?',
        'Without running the code, predict the exact stdout (including order). Then optionally run mentally-check your answer. Submit the predicted output and brief explanation for AI grading.',
        'easy',
        15,
        '{
            "execution": "none",
            "prompt": "Mention closure capture, loop variable aliasing, and goroutine scheduling.",
            "editor_preset": {
                "go": {
                    "solution": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfor i := 0; i < 3; i++ {\n\t\tgo func() {\n\t\t\tfmt.Print(i)\n\t\t}()\n\t}\n\t// What prints? Explain.\n}\n"
                },
                "javascript": {
                    "solution": "for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}\n// What prints? Explain.\n"
                }
            }
        }'::jsonb,
        'published'
    )
ON CONFLICT (id) DO NOTHING;

-- Live coding runnable mirrors of classic algo (for /mock Coding + company track)
INSERT INTO tasks (id, slug, type, title, description, difficulty, estimated_minutes, metadata, status)
SELECT
    'b0000000-0000-4000-8000-000000000011',
    slug || '-lc',
    'live_coding',
    title || ' (Live)',
    description,
    difficulty,
    estimated_minutes,
    metadata,
    status
FROM tasks WHERE id = 'b0000000-0000-4000-8000-000000000001'
ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, type = EXCLUDED.type, title = EXCLUDED.title;

INSERT INTO tasks (id, slug, type, title, description, difficulty, estimated_minutes, metadata, status)
SELECT
    'b0000000-0000-4000-8000-000000000012',
    slug || '-lc',
    'live_coding',
    title || ' (Live)',
    description,
    difficulty,
    estimated_minutes,
    metadata,
    status
FROM tasks WHERE id = 'b0000000-0000-4000-8000-000000000002'
ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, type = EXCLUDED.type, title = EXCLUDED.title;

INSERT INTO tasks (id, slug, type, title, description, difficulty, estimated_minutes, metadata, status)
SELECT
    'b0000000-0000-4000-8000-000000000013',
    slug || '-lc',
    'live_coding',
    title || ' (Live)',
    description,
    difficulty,
    estimated_minutes,
    metadata,
    status
FROM tasks WHERE id = 'b0000000-0000-4000-8000-000000000003'
ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, type = EXCLUDED.type, title = EXCLUDED.title;

-- ── 3. System design ──────────────────────────────────────────────────────────

INSERT INTO tasks (id, slug, type, title, description, difficulty, estimated_minutes, metadata, status)
VALUES
    (
        'b0000000-0000-4000-8000-000000000020',
        'design-url-shortener',
        'system_design',
        'Design a URL Shortener',
        'Design a service like bit.ly: shorten URLs, redirect, analytics. Cover API, storage, id generation, hot links, and tradeoffs at 10M DAU.',
        'medium',
        35,
        '{"execution":"none","prompt":"Structure: requirements, API, data model, core flows, scaling, failure modes.","hints":["Base62 vs hash collision","Cache hot redirects"]}'::jsonb,
        'published'
    ),
    (
        'b0000000-0000-4000-8000-000000000021',
        'design-rate-limiter',
        'system_design',
        'Design a Rate Limiter',
        'Design a distributed rate limiter for HTTP APIs (per user + per IP). Compare token bucket vs sliding window. How do you deploy it with minimal latency?',
        'medium',
        30,
        '{"execution":"none","prompt":"Cover algorithms, Redis vs in-memory, clock skew, burst traffic, and observability.","hints":["Token bucket for bursts","Central vs edge enforcement"]}'::jsonb,
        'published'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO rubrics (id, task_type, title, version, is_active)
VALUES (
    'd0000000-0000-4000-8000-000000000004',
    'system_design',
    'System Design Rubric',
    1,
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO rubric_criteria (id, rubric_id, key, title, description, weight, max_score, position)
VALUES
    ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000004', 'requirements', 'Requirements', 'Clarifies functional and non-functional requirements.', 25, 100, 1),
    ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000004', 'architecture', 'Architecture', 'Coherent components, data flows, and tradeoffs.', 40, 100, 2),
    ('e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000004', 'scaling', 'Scaling & Reliability', 'Bottlenecks, caching, sharding, failure handling.', 35, 100, 3)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Yandex template: live_coding + system_design sections ─────────────────

INSERT INTO template_sections (id, template_id, section_type, title, description, position, passing_score)
VALUES
    (
        'a0000000-0000-4000-8000-000000000005',
        'a0000000-0000-4000-8000-000000000002',
        'live_coding',
        'Live Coding',
        'Practical coding, review, and output prediction.',
        3,
        85
    ),
    (
        'a0000000-0000-4000-8000-000000000006',
        'a0000000-0000-4000-8000-000000000002',
        'system_design',
        'System Design',
        'Architecture and scaling discussion.',
        4,
        80
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_section_tasks (section_id, task_id, position)
VALUES
    ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000011', 1),
    ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000012', 2),
    ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000008', 3),
    ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000009', 4),
    ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000010', 5),
    ('a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000020', 1),
    ('a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000021', 2)
ON CONFLICT DO NOTHING;

-- ── 5. Google company + template ──────────────────────────────────────────────

INSERT INTO companies (id, slug, name, description, is_active)
VALUES (
    'a0000000-0000-4000-8000-000000000010',
    'google',
    'Google',
    'Interview track inspired by Google-style backend loops.',
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO interview_templates (id, company_id, slug, title, description, target_role, target_level, passing_score, is_active)
VALUES (
    'a0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000010',
    'google-backend-mid',
    'Google Backend — Mid',
    'Algorithms, live coding, and system design for mid-level backend.',
    'backend',
    'mid',
    85,
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO template_sections (id, template_id, section_type, title, description, position, passing_score)
VALUES
    ('a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000011', 'algorithm', 'Algorithms', 'Classic DS&A.', 1, 85),
    ('a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000011', 'live_coding', 'Live Coding', 'Hands-on coding and review.', 2, 85),
    ('a0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000011', 'system_design', 'System Design', 'Large-scale design.', 3, 80),
    ('a0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000011', 'behavioral', 'Behavioral', 'Leadership and collaboration.', 4, 80)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_section_tasks (section_id, task_id, position)
VALUES
    ('a0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000004', 1),
    ('a0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000005', 2),
    ('a0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000013', 1),
    ('a0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000009', 2),
    ('a0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000021', 1),
    ('a0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000007', 1)
ON CONFLICT DO NOTHING;

-- Behavioral metadata polish
UPDATE tasks SET metadata = metadata || '{"execution":"none"}'::jsonb
WHERE type = 'behavioral' AND NOT (metadata ? 'execution');

INSERT INTO articles (id, slug, title, summary, body, status, reading_minutes)
VALUES (
    'c0000000-0000-4000-8000-000000000001',
    'arrays-and-two-pointers',
    'Arrays & two pointers',
    'How to recognize array patterns and use two pointers to avoid extra memory.',
    E'## When to use two pointers

Many array problems ask for a pair of indices or a subarray with a property. If the input can be scanned from both ends (sorted array, palindrome, container with two boundaries), two pointers often give O(n) time and O(1) extra space.

## Checklist before coding

1. Can you sort or is the array already sorted?
2. Do you need all pairs or only one optimal pair?
3. Can you move the left or right pointer based on a comparison?

## Template

```python
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return left, right
        if total < target:
            left += 1
        else:
            right -= 1
    return -1, -1
```

Use **two pointers** when the array is sorted or you can reason about monotonic movement.

## Next step

After reading, run solo algorithms training from the practice block below.',
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
    E'## STAR in one minute

- **Situation** — one sentence of context.
- **Task** — your responsibility.
- **Action** — what you did (use "I", be specific).
- **Result** — measurable outcome or lesson.

## Common mistake

Jumping to Action without Situation. The interviewer cannot score ownership and impact.

## Next step

Rewrite a weak behavioral attempt using STAR, then run a short behavioral mock.',
    'published',
    5
) ON CONFLICT (id) DO NOTHING;

INSERT INTO article_skill_keys (article_id, skill_key)
VALUES
    ('c0000000-0000-4000-8000-000000000002', 'behavioral.overall')
ON CONFLICT DO NOTHING;

INSERT INTO article_videos (article_id, title, url, provider, position, duration_seconds)
VALUES (
    'c0000000-0000-4000-8000-000000000001',
    'Two pointers pattern (NeetCode)',
    'https://www.youtube.com/watch?v=cQ1Oz4ckceM',
    'youtube',
    1,
    720
) ON CONFLICT DO NOTHING;

INSERT INTO article_tasks (article_id, task_id, position)
VALUES
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 1),
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 2)
ON CONFLICT DO NOTHING;

INSERT INTO article_tasks (article_id, task_id, position)
VALUES
    ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 1)
ON CONFLICT DO NOTHING;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Forward-only. Full wipe: deploy/scripts/reset-databases.sh
SELECT 1;
-- +goose StatementEnd
