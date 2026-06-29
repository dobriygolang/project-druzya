# AGENTS.md — recommendation service

Self-contained. Work from `services/recommendation/` only.

Module: `github.com/sedorofeevd/project-druzya/services/recommendation`

## Purpose

Consume interview outbox → update skill profiles/scores → **sync learning tasks into tracker** + score daily plan.

**Tracker is the canonical task list** — Today UI reads `GET /v1/tracker/today`; recommendation runs reconcile + priority scoring internally.

Calls **ai-service** only for optional tracker **smart parse** (`ClassifyTrackerTask`) when user enables it in tracker settings.

## Ports

HTTP `8084` | gRPC `9094` | PG `5436` `druzya_recommendation`

## Layout

```
cmd/recommendation/app/
cmd/migrate-learning-plan/     one-shot learning_plan → tracker migration
internal/recommendation/       model, repository, service, plan/, copy/
internal/adapter/interview/    outbox claim/ack/fail, eval summary, retries
internal/adapter/content/      GetTask (legacy fallback when outbox payload lacks task_type)
internal/adapter/tracker/      board ensure, CreateTaskInternal, settings, metadata patch
internal/adapter/ai/           ClassifyTrackerTask (smart parse)
internal/outboxworker/         poll interview + tracker outbox
internal/app/api/recommendation/
scripts/migrations/
```

## Outbox worker

Polls interview internal API every `WORKER_POLL_INTERVAL` (default 2s).

**Do not use `OutboxClaimAll` (`"*"`).** ai-service owns `interview.attempt_submitted`; a wildcard claim races with it.

Interview events (one claim round-trip per type):

| Event | Handler | Effect |
|-------|---------|--------|
| `interview.attempt_evaluated` | `HandleAttemptEvaluated` | skills, readiness, improve_skill, special recs → tracker tasks |
| `interview.session_completed` | `HandleSessionCompleted` | mock interview if readiness≥80; practice weak section |
| `interview.retry_item_created` | `HandleRetryItemCreated` | retry task → tracker |
| `interview.task_skipped` | `HandleTaskSkipped` | ensure user profile exists (idempotent) |

Tracker events (via `internal/outboxworker/tracker_runner.go`):

| Event | Handler | Effect |
|-------|---------|--------|
| `tracker.task_created` | `HandleTrackerTaskCreated` | smart parse (if enabled) → enrichment child tasks |
| `tracker.task_completed` | `HandleTrackerTaskCompleted` | article read / recommendation complete / interview retry complete |

### Smart parse (`HandleTrackerTaskCreated`)

When `task_kind=general` and tracker `GetUserSettings.smart_parse_enabled`:

1. `ai.ClassifyTrackerTask(title)`
2. `tracker.PatchTaskMetadata` with kind + metadata
3. Re-evaluate `classify.ShouldEnrich` for learning enrichment

## Daily plan

- `plan/desired_tasks.go` — idempotent desired tasks (retries, stale review, skills, mock) with epic + estimate.
- `ReconcileUserPlan` (internal) — pushes missing tasks via `CreateTaskInternal` (debounced 30s/user).
- `PlanToday` (internal) — scores open sprint tasks, greedy 1.5 person-day budget partition. **Scoring stays here** — tracker does not duplicate skill/readiness/stale logic.
- `GetDashboard` — readiness, strengths, weaknesses, coach recommendations only (`daily_brief.items` empty; use tracker Today).

### Planner rules

- **User sovereignty:** reconcile pushes only tasks with `dedup_key` + `system_managed` metadata; `pushTrackerTask` no-ops without dedup; never deletes user tasks.
- **Done tasks:** tracker dedup returns existing done row without insert; planner does not recreate.
- **Sprint overload:** reconcile does not check sprint capacity (advisory overload bar on Tasks page).
- **Timezone MVP:** client passes `local_date` + `timezone`; `plan.ResolvePlanClock` anchors scoring `now` and reconcile debounce (`user_id|local_date`); tracker falls back to identity profile TZ when client omits timezone.

## Article read progress

Table `article_reads(user_id, article_slug)`. `MarkArticleRead` upserts on scroll/complete from web.

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetDashboard | `GET /v1/recommendations/dashboard` | JWT |
| GetMockHubContext | `GET /v1/recommendations/mock-hub` | JWT |
| MarkArticleRead | `POST /v1/recommendations/articles/{slug}/read` | JWT |
| DismissRecommendation | `POST /v1/recommendations/{id}/dismiss` | JWT |
| CompleteRecommendation | `POST /v1/recommendations/{id}/complete` | JWT |

Internal (`RecommendationInternalService`, `x-internal-token`):

| RPC | Used by |
|-----|---------|
| GetTaskPickerHints | interview task picker |
| ReconcileUserPlan | tracker `GetToday` |
| PlanToday | tracker `GetToday` |

## Migration

```bash
cd services/recommendation
make migrate-learning-plan-to-tracker
```

Reads pending `learning_plan_items`, creates tracker tasks with dedup `migrated:plan:{id}`. Exits 0 if table already dropped.

## Commands

```bash
cd services/recommendation
make start | gen-proto | test | lint | build
```

## Env

| Variable | Default |
|----------|---------|
| HTTP_PORT | 8084 |
| GRPC_PORT | 9094 |
| POSTGRES_DSN | localhost:5436 / `druzya_recommendation` |
| JWT_PUBLIC_KEY / JWT_PUBLIC_KEY_FILE | required |
| INTERNAL_API_TOKEN | required |
| INTERVIEW_GRPC_ADDR | `127.0.0.1:9092` |
| CONTENT_GRPC_ADDR | `127.0.0.1:9091` |
| TRACKER_GRPC_ADDR | `127.0.0.1:9099` |
| AI_GRPC_ADDR | `127.0.0.1:9093` (optional; smart parse skipped if unreachable) |
| WORKER_POLL_INTERVAL | `2s` |

## Agent tokens (cavecrew)

`.cursor/rules/cavecrew.mdc` — investigator/builder/reviewer for compressed subagent output.
