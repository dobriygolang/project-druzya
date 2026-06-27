-- +goose Up
-- +goose StatementBegin
-- Enrich Yandex algorithm tasks with sandbox live-coding metadata (stdin/stdout tests).

UPDATE tasks SET
    type = 'live_coding',
    metadata = metadata || '{
        "starter_code": {
            "go": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\tnums := strings.Fields(scanner.Text())\n\tscanner.Scan()\n\ttarget, _ := strconv.Atoi(strings.TrimSpace(scanner.Text()))\n\tseen := make(map[int]int)\n\tfor i, raw := range nums {\n\t\tn, _ := strconv.Atoi(raw)\n\t\tif j, ok := seen[target-n]; ok {\n\t\t\tfmt.Printf(\"%d %d\\n\", j, i)\n\t\t\treturn\n\t\t}\n\t\tseen[n] = i\n\t}\n}",
            "python": "import sys\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    nums = list(map(int, lines[0].split()))\n    target = int(lines[1])\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            print(seen[target - n], i)\n            return\n        seen[n] = i\n\nif __name__ == \"__main__\":\n    main()\n",
            "javascript": "const fs = require(''fs'');\n\nfunction main() {\n  const lines = fs.readFileSync(0, ''utf8'').trim().split(''\\n'');\n  const nums = lines[0].split('' '').map(Number);\n  const target = Number(lines[1]);\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const n = nums[i];\n    if (seen.has(target - n)) {\n      console.log(`${seen.get(target - n)} ${i}`);\n      return;\n    }\n    seen.set(n, i);\n  }\n}\n\nmain();\n"
        },
        "examples": [
            {
                "name": "example 1",
                "input": "2 7 11 15\n9\n",
                "expected_output": "0 1",
                "explanation": "nums[0] + nums[1] == 9"
            }
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
    type = 'live_coding',
    metadata = metadata || '{
        "starter_code": {
            "go": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\ts := scanner.Text()\n\tstack := []rune{}\n\tpairs := map[rune]rune{''('': '')'', ''['': '']'', ''{'': ''}''}\n\tfor _, ch := range s {\n\t\tswitch ch {\n\t\tcase ''('', ''['', ''{'':\n\t\t\tstack = append(stack, ch)\n\t\tdefault:\n\t\t\tif len(stack) == 0 || pairs[stack[len(stack)-1]] != ch {\n\t\t\t\tfmt.Println(\"false\")\n\t\t\t\treturn\n\t\t\t}\n\t\t\tstack = stack[:len(stack)-1]\n\t\t}\n\t}\n\tfmt.Println(len(stack) == 0)\n}",
            "python": "import sys\n\ndef main():\n    s = sys.stdin.readline().strip()\n    pairs = {''('': '')'', ''['': '']'', ''{'': ''}''}\n    stack = []\n    for ch in s:\n        if ch in pairs:\n            stack.append(ch)\n        else:\n            if not stack or pairs[stack.pop()] != ch:\n                print(''false'')\n                return\n    print(''true'' if not stack else ''false'')\n\nif __name__ == \"__main__\":\n    main()\n",
            "javascript": "const fs = require(''fs'');\n\nfunction main() {\n  const s = fs.readFileSync(0, ''utf8'').trim();\n  const pairs = { ''('': '')'', ''['': '']'', ''{'': ''}'' };\n  const stack = [];\n  for (const ch of s) {\n    if (pairs[ch]) stack.push(ch);\n    else {\n      const top = stack.pop();\n      if (!top || pairs[top] !== ch) {\n        console.log(''false'');\n        return;\n      }\n    }\n  }\n  console.log(stack.length === 0 ? ''true'' : ''false'');\n}\n\nmain();\n"
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
    type = 'live_coding',
    metadata = metadata || '{
        "starter_code": {
            "go": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\ta := parseList(scanner.Text())\n\tscanner.Scan()\n\tb := parseList(scanner.Text())\n\tfmt.Println(merge(a, b))\n}\n\nfunc parseList(s string) []int {\n\tparts := strings.Fields(s)\n\tout := make([]int, len(parts))\n\tfor i, p := range parts {\n\t\tout[i], _ = strconv.Atoi(p)\n\t}\n\treturn out\n}\n\nfunc merge(a, b []int) []int {\n\ti, j := 0, 0\n\tout := make([]int, 0, len(a)+len(b))\n\tfor i < len(a) && j < len(b) {\n\t\tif a[i] <= b[j] {\n\t\t\tout = append(out, a[i])\n\t\t\ti++\n\t\t} else {\n\t\t\tout = append(out, b[j])\n\t\t\tj++\n\t\t}\n\t}\n\tout = append(out, a[i:]...)\n\tout = append(out, b[j:]...)\n\treturn out\n}",
            "python": "import sys\n\ndef merge(a, b):\n    i = j = 0\n    out = []\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    out.extend(a[i:]); out.extend(b[j:])\n    return out\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    a = list(map(int, lines[0].split()))\n    b = list(map(int, lines[1].split()))\n    print('' ''.join(map(str, merge(a, b))))\n\nif __name__ == \"__main__\":\n    main()\n",
            "javascript": "const fs = require(''fs'');\n\nfunction merge(a, b) {\n  const out = [];\n  let i = 0, j = 0;\n  while (i < a.length && j < b.length) {\n    if (a[i] <= b[j]) out.push(a[i++]);\n    else out.push(b[j++]);\n  }\n  return out.concat(a.slice(i), b.slice(j));\n}\n\nfunction main() {\n  const lines = fs.readFileSync(0, ''utf8'').trim().split(''\\n'');\n  const a = lines[0].split('' '').map(Number);\n  const b = lines[1].split('' '').map(Number);\n  console.log(merge(a, b).join('' ''));\n}\n\nmain();\n"
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
    type = 'live_coding',
    metadata = metadata || '{
        "starter_code": {
            "go": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\tn, _ := strconv.Atoi(scanner.Text())\n\tscanner.Scan()\n\tnums := parseInts(scanner.Text())\n\tscanner.Scan()\n\ttarget, _ := strconv.Atoi(scanner.Text())\n\tfmt.Println(search(nums[:n], target))\n}\n\nfunc parseInts(s string) []int {\n\tparts := strings.Fields(s)\n\tout := make([]int, len(parts))\n\tfor i, p := range parts {\n\t\tout[i], _ = strconv.Atoi(p)\n\t}\n\treturn out\n}\n\nfunc search(nums []int, target int) int {\n\tlo, hi := 0, len(nums)-1\n\tfor lo <= hi {\n\t\tmid := (lo + hi) / 2\n\t\tif nums[mid] == target {\n\t\t\treturn mid\n\t\t}\n\t\tif nums[mid] < target {\n\t\t\tlo = mid + 1\n\t\t} else {\n\t\t\thi = mid - 1\n\t\t}\n\t}\n\treturn -1\n}",
            "python": "import sys\n\ndef search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\ndef main():\n    lines = sys.stdin.read().splitlines()\n    n = int(lines[0])\n    nums = list(map(int, lines[1].split()))[:n]\n    target = int(lines[2])\n    print(search(nums, target))\n\nif __name__ == \"__main__\":\n    main()\n",
            "javascript": "const fs = require(''fs'');\n\nfunction search(nums, target) {\n  let lo = 0, hi = nums.length - 1;\n  while (lo <= hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}\n\nfunction main() {\n  const lines = fs.readFileSync(0, ''utf8'').trim().split(''\\n'');\n  const n = Number(lines[0]);\n  const nums = lines[1].split('' '').map(Number).slice(0, n);\n  const target = Number(lines[2]);\n  console.log(search(nums, target));\n}\n\nmain();\n"
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
    type = 'live_coding',
    metadata = metadata || '{
        "starter_code": {
            "go": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\ts := scanner.Text()\n\tlast := make(map[byte]int)\n\tstart := 0\n\tbest := 0\n\tfor i := 0; i < len(s); i++ {\n\t\tif idx, ok := last[s[i]]; ok && idx >= start {\n\t\t\tstart = idx + 1\n\t\t}\n\t\tlast[s[i]] = i\n\t\tif i-start+1 > best {\n\t\t\tbest = i - start + 1\n\t\t}\n\t}\n\tfmt.Println(best)\n}",
            "python": "import sys\n\ndef length_of_longest_substring(s):\n    last = {}\n    start = 0\n    best = 0\n    for i, ch in enumerate(s):\n        if ch in last and last[ch] >= start:\n            start = last[ch] + 1\n        last[ch] = i\n        best = max(best, i - start + 1)\n    return best\n\ndef main():\n    s = sys.stdin.readline().strip()\n    print(length_of_longest_substring(s))\n\nif __name__ == \"__main__\":\n    main()\n",
            "javascript": "const fs = require(''fs'');\n\nfunction lengthOfLongestSubstring(s) {\n  const last = new Map();\n  let start = 0, best = 0;\n  for (let i = 0; i < s.length; i++) {\n    const ch = s[i];\n    if (last.has(ch) && last.get(ch) >= start) start = last.get(ch) + 1;\n    last.set(ch, i);\n    best = Math.max(best, i - start + 1);\n  }\n  return best;\n}\n\nfunction main() {\n  const s = fs.readFileSync(0, ''utf8'').trim();\n  console.log(lengthOfLongestSubstring(s));\n}\n\nmain();\n"
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
DELETE FROM rubric_criteria WHERE id IN (
    'e0000000-0000-4000-8000-000000000006',
    'e0000000-0000-4000-8000-000000000007',
    'e0000000-0000-4000-8000-000000000008'
);
DELETE FROM rubrics WHERE id = 'd0000000-0000-4000-8000-000000000003';

UPDATE tasks SET type = 'algorithm', metadata = '{"constraints":["2 <= nums.length <= 10^4","Exactly one valid pair exists"],"hints":["Use a hash map to store seen values"]}'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000001';
UPDATE tasks SET type = 'algorithm', metadata = '{"constraints":["1 <= s.length <= 10^4"],"hints":["Use a stack"]}'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000002';
UPDATE tasks SET type = 'algorithm', metadata = '{"constraints":["Both lists are sorted in non-decreasing order"],"hints":["Iterate with a dummy head node"]}'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000003';
UPDATE tasks SET type = 'algorithm', metadata = '{"constraints":["All values in nums are unique","Array is sorted ascending"],"hints":["Maintain left/right pointers"]}'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000004';
UPDATE tasks SET type = 'algorithm', metadata = '{"constraints":["0 <= s.length <= 5 * 10^4"],"hints":["Sliding window with last-seen index map"]}'::jsonb
WHERE id = 'b0000000-0000-4000-8000-000000000005';
-- +goose StatementEnd
