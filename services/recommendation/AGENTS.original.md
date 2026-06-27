# AGENTS.md — recommendation service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/recommendation`

## Purpose

Consumes interview outbox events, updates user skill profiles and scores, and exposes personalized recommendations and learning plans.

## Layout

```
cmd/recommendation/app/       DI + server + worker
api/recommendation/v1/
internal/recommendation/      domain (model, repository, service)
internal/adapter/interview/   interview internal gRPC client
internal/adapter/content/     content GetTask client
internal/outboxworker/        multi-event consumer
internal/app/api/recommendation/
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Ports

| Protocol | Value |
|----------|---------|
| HTTP | 8084 |
| gRPC | 9094 |
| Postgres | 5436 / `druzya_recommendation` |

## Commands

```bash
make start    # deps + migrate + run
make run
make gen-proto
make test
make lint
```

See `make help`.

## Env

| Variable | Required | Default |
|----------|----------|---------|
| `JWT_PUBLIC_KEY` or `JWT_PUBLIC_KEY_FILE` | yes | — |
| `INTERNAL_API_TOKEN` | yes | — |
| `INTERVIEW_GRPC_ADDR` | no | `127.0.0.1:9092` |
| `CONTENT_GRPC_ADDR` | no | `127.0.0.1:9091` |
| `WORKER_POLL_INTERVAL` | no | `2s` |

## Event flow

Worker polls three interview outbox event types:

| Event | Handler | Effect |
|-------|---------|--------|
| `interview.attempt_evaluated` | `HandleAttemptEvaluated` | skill_scores, readiness, retry plan, improve_skill |
| `interview.session_completed` | `HandleSessionCompleted` | take_mock_interview (readiness ≥ 80), practice_section for weakest skill |
| `interview.retry_item_created` | `HandleRetryItemCreated` | reconcile retry_task plan item (idempotent dedup) |

Idempotency via `processed_events` (per consumer + outbox event ID). Domain writes run inside `Repository.WithTx`.

## References

| Service | Use for |
|---------|---------|
| **ai** | outbox worker pattern |
| **interview** | JWT auth interceptor, internal gRPC, outbox publisher |
| **content** | GetTask adapter |
