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

| `practice_scope` | Behavior |
|------------------|----------|
| `random_one` (default) | Exclude passed tasks + pending retry; if pool empty → random repeat from full catalog |
| `company_track` | Same filters on company template tasks |
| `review` | Prefer tasks passed 14+ days ago; fallback to fresh logic |

Retry queue stays separate (`retry_mistakes` mode) — failed tasks are not mixed into solo random.

## APIs

| RPC | HTTP | Consumer |
|-----|------|----------|
| `GetMockHubContext` | `GET /v1/recommendations/mock-hub` | Mock hub UI |
| `GetTaskPickerHints` | internal gRPC | interview-service |

Mock hub context returns:

- `stale_modes` — sections to revisit
- `template_progress` — company template badges
- `task_type_coverage` — passed counts per task type

## UI surfaces

- **Mock hub** — stale sections card; solo modal scopes (New / Review / Company track); template passed badges
- **Session results** — outcome badge (passed / below threshold)
- **Today brief** — `practice_stale_mode` items → `/mock?solo=…&scope=review`

## Deploy checklist

```bash
cd services/recommendation && make migrate-up
cd services/interview && make migrate-up   # outcome + paused migrations
# redeploy recommendation, interview, web
# set RECOMMENDATION_GRPC_ADDR on interview (default 127.0.0.1:9094)
```

## Related

- [services/interview/AGENTS.md](../../services/interview/AGENTS.md)
- [services/recommendation/AGENTS.md](../../services/recommendation/AGENTS.md)
