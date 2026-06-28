# AGENTS.md — recommendation service

Self-contained. Work from `services/recommendation/` only.

Module: `github.com/sedorofeevd/project-druzya/services/recommendation`

## Purpose

Consume interview outbox → update skill profiles/scores → recommendations + learning plan API.

## Ports

HTTP `8084` | gRPC `9094` | PG `5436` `druzya_recommendation`

## Layout

```
cmd/recommendation/app/
internal/recommendation/     model, repository, service
internal/adapter/interview/  outbox claim/ack/fail, eval summary, retries
internal/adapter/content/    GetTask (legacy fallback when outbox payload lacks task_type)
internal/adapter/ai/         GenerateProfileSummary (best-effort dashboard copy)
internal/outboxworker/       poll interview outbox by event name (4 types)
internal/app/api/recommendation/
scripts/migrations/
```

## Outbox worker

Polls interview internal API every `WORKER_POLL_INTERVAL` (default 2s).

**Do not use `OutboxClaimAll` (`"*"`).** ai-service owns `interview.attempt_submitted`; a wildcard claim races with it.

One claim round-trip **per owned event type**:

| Event | Handler | Effect |
|-------|---------|--------|
| `interview.attempt_evaluated` | `HandleAttemptEvaluated` | skills, readiness, improve_skill, special recs |
| `interview.session_completed` | `HandleSessionCompleted` | mock interview if readiness≥80; practice weak section |
| `interview.retry_item_created` | `HandleRetryItemCreated` | **only** path for `retry_task` plan item |
| `interview.task_skipped` | `HandleTaskSkipped` | ensure user profile exists (idempotent) |

Implementation: `internal/outboxworker/runner.go` → `handledEventNames`.

On success: `AckOutboxEvents`. On handler error: `FailOutboxEvent`.

**Legacy fallback:** events without `task_type` / `criteria` still trigger sync `GetTask` + `GetEvaluationSummaryInternal`.

**Metrics:** `outbox_lag_seconds`, `outbox_handler_duration_seconds` on `/metrics`. Logs include `attempt_id` when present in payload.

Idempotency: `processed_events(consumer, event_id)`. Writes in `Repository.WithTx`.

Profile summary refresh runs in a goroutine after the DB tx (does not block outbox ack).

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetDashboard | `GET /v1/recommendations/dashboard` | JWT |
| DismissRecommendation | `POST /v1/recommendations/{id}/dismiss` | JWT |
| CompleteRecommendation | `POST /v1/recommendations/{id}/complete` | JWT |
| CompleteLearningPlanItem | `POST /v1/recommendations/learning-plan/{id}/complete` | JWT |
| DismissLearningPlanItem | `POST /v1/recommendations/learning-plan/{id}/dismiss` | JWT |

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
| AI_GRPC_ADDR | `127.0.0.1:9093` (optional; noop profile summary if unset) |
| WORKER_POLL_INTERVAL | `2s` |

## Agent tokens (cavecrew)

`.cursor/rules/cavecrew.mdc` — investigator/builder/reviewer for compressed subagent output.
