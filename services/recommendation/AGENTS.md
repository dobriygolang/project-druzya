# AGENTS.md — recommendation service

Self-contained. Work from `services/recommendation/` only.

Module: `github.com/sedorofeevd/project-druzya/services/recommendation`

## Purpose

Consume interview outbox → update skill profiles/scores → recommendations + **structured daily brief** for Today.

**Tracker is the canonical task list** — learning plan items were removed; pending items migrate to tracker via `make migrate-learning-plan-to-tracker`.

Calls **ai-service** only for optional tracker **smart parse** (`ClassifyTrackerTask`) when user enables it in tracker settings.

## Ports

HTTP `8084` | gRPC `9094` | PG `5436` `druzya_recommendation`

## Layout

```
cmd/recommendation/app/
cmd/migrate-learning-plan/     one-shot learning_plan → tracker migration
internal/recommendation/       model, repository, service, copy/, brief builder
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

## Daily brief (`GetDashboard`)

Built on read in `service/brief.go` from readiness, weaknesses, active recommendations, pending retry queue, and content articles. **No learning plan block.**

## Article read progress

Table `article_reads(user_id, article_slug)`. `MarkArticleRead` upserts on scroll/complete from web.

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetDashboard | `GET /v1/recommendations/dashboard` | JWT |
| MarkArticleRead | `POST /v1/recommendations/articles/{slug}/read` | JWT |
| DismissRecommendation | `POST /v1/recommendations/{id}/dismiss` | JWT |
| CompleteRecommendation | `POST /v1/recommendations/{id}/complete` | JWT |

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
