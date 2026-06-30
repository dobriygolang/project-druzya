> **ARCHIVED** — documents removed services (interview, recommendation, admin). See [onboarding README](../onboarding/README.md#retired-services).

# Mock progress & task picking

How druz9 remembers what you passed, avoids repeats, and nudges section balance.

## Data (recommendation-service)

| Table | Purpose |
|-------|---------|
| `user_task_progress` | Per task: best score, `passed` (≥ session threshold), attempt counts, timestamps |
| `user_template_progress` | Company template mocks: best total score, passed, last session |
| `user_practice_mode_activity` | Last solo practice per training mode (algo, live coding, …) |

Updated from interview outbox:

- `interview.attempt_evaluated` → task progress + mode activity (payload includes `mode`, `task_type`, `passed`, `score`)
- `interview.session_completed` → template progress when `template_id` + `company_interview` (payload includes `outcome`, `passing_score`)

Stale threshold: **14 days** (`StalePracticeDays` in recommendation service).

## Session outcome (interview-service)

Column `interview_sessions.outcome`: `passed` | `failed` (set when session completes).

- Rule: `total_score >= passing_score` → passed, else failed.
- Exposed on `Session.outcome` in API and results UI.

## Task picking (interview-service)

On `StartInterviewSession` (solo / company track), interview calls recommendation internal **`GetTaskPickerHints`** and local retry list.
