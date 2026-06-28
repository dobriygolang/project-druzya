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
internal/adapter/interview/  outbox + eval summary + retries
internal/adapter/content/    GetTask
internal/outboxworker/       single poll `ClaimOutboxEvents("*")`
internal/app/api/recommendation/
scripts/migrations/
```

## Events (worker)

One poll/tick via `OutboxClaimAll` (`"*"`). Route by `event_name`:

| Event | Handler | Effect |
|-------|---------|--------|
| `attempt_evaluated` | `HandleAttemptEvaluated` | skills, readiness, improve_skill, special recs |
| `session_completed` | `HandleSessionCompleted` | mock interview if readiness≥80; practice weak section |
| `retry_item_created` | `HandleRetryItemCreated` | **only** path for `retry_task` plan item |

Idempotency: `processed_events(consumer, event_id)`. Writes in `Repository.WithTx`.

## API

`GET /v1/recommendations/dashboard` | dismiss/complete recs + plan items. JWT user_id.

## Commands

```bash
cd services/recommendation
make start | gen-proto | test | lint | build
```

## Env

`JWT_PUBLIC_KEY`/`JWT_PUBLIC_KEY_FILE` (req) | `INTERNAL_API_TOKEN` (req) | `INTERVIEW_GRPC_ADDR` `127.0.0.1:9092` | `CONTENT_GRPC_ADDR` `127.0.0.1:9091` | `WORKER_POLL_INTERVAL` `2s`

## Agent tokens (cavecrew)

`.cursor/rules/cavecrew.mdc` — investigator/builder/reviewer for compressed subagent output.
