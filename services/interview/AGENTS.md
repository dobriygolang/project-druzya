# AGENTS.md — interview service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/interview`

## Purpose

User interview **runtime**: sessions, assigned tasks, attempts, evaluation summaries, retry queue, progress.

Does **not** own: users/auth, catalog tasks/rubrics/solutions, AI model calls, billing.

| Question | Service |
|----------|---------|
| What can user pass? | content |
| What is user passing now? | **interview** |
| How to score an answer? | ai (calls interview internal API) |

## Ports

| Protocol | Default |
|----------|---------|
| HTTP | 8082 |
| gRPC | 9092 |
| Postgres | 5434 (`druzya_interview`) |
| Content gRPC | `127.0.0.1:9091` |

## Layout

```
cmd/interview/
api/interview/v1/
pkg/api/interview/v1/       — generated
pkg/client/                 — Client (user-facing) + InternalClient (ai-service)
internal/interview/
  model/                    — entities + enums
  repository/               — postgres
  service/                  — Service interface + use cases
internal/adapter/
  content/                  — ContentClient port + gRPC impl
  events/                   — EventPublisher (logger → databus later)
internal/app/api/interview/ — gRPC/HTTP transport (one RPC per file)
internal/config/
internal/tools/
scripts/migrations/
scripts/dev/docker-compose.yml
databus/                    — reserved for outbox/events
```

## Domain enums

**Session mode:** `company_interview`, `algorithms_training`, `live_coding_training`, `system_design_training`, `behavioral_training`, `sql_training`, `retry_mistakes`

**Session status:** `active`, `completed`, `cancelled`, `expired`

**Section status:** `pending`, `active`, `completed`

**Session task status:** `assigned`, `submitted`, `evaluated`, `skipped`

**Attempt status:** `submitted`, `evaluating`, `evaluated`, `failed`, `cancelled`

**Retry status:** `pending`, `in_progress`, `completed`, `dismissed`

## Tables

- `interview_sessions` — one active session per user (partial unique index)
- `interview_session_sections` — snapshot from content template
- `session_tasks` — `task_id` references content (no FK)
- `attempts` — unique per `session_task_id`
- `evaluation_summaries` — user-facing score (1:1 attempt)
- `retry_items` — failed tasks queue
- `domain_outbox` — durable events for ai-service (transactional with SubmitAttempt)

## Outbox → ai-service

`SubmitAttempt` writes `interview.attempt_submitted` to `domain_outbox` in the same transaction as the attempt.

ai-service claims via internal gRPC (`ClaimOutboxEvents` / `AckOutboxEvents` / `FailOutboxEvent`) — **no direct DB access to interview**.

Internal RPCs on `InterviewInternalService` (`x-internal-token`):

- `GetAttemptInternal`
- `CompleteEvaluation`
- `ClaimOutboxEvents` / `AckOutboxEvents` / `FailOutboxEvent`

## Content boundary

Use `internal/adapter/content.Client` only:

- `GetInterviewTemplateDetail`
- `GetTask`
- `ListTasks` (training modes)

Never read content postgres tables.

## API (HTTP via grpc-gateway)

| RPC | HTTP | Auth |
|-----|------|------|
| StartInterviewSession | `POST /v1/interview/sessions` | JWT |
| GetInterviewSession | `GET /v1/interview/sessions/{id}` | JWT |
| GetCurrentSessionState | `GET /v1/interview/sessions/{id}/current` | JWT |
| GetSessionResults | `GET /v1/interview/sessions/{id}/results` | JWT |
| CancelSession | `POST /v1/interview/sessions/{id}/cancel` | JWT |
| SubmitAttempt | `POST /v1/interview/session-tasks/{id}/attempts` | JWT |
| SkipTask | `POST /v1/interview/session-tasks/{id}/skip` | JWT |
| GetAttempt | `GET /v1/interview/attempts/{id}` | JWT |
| ListRetryItems | `GET /v1/interview/retry-items` | JWT |
| DismissRetryItem | `POST /v1/interview/retry-items/{id}/dismiss` | JWT |
| StartRetrySession | `POST /v1/interview/retry-sessions` | JWT |
| CompleteEvaluation | gRPC internal only | `x-internal-token` |

Proto uses typed enums (`SessionMode`, `SessionStatus`, etc.) — map in `internal/app/api/interview/proto_enums.go`.

## Events

Published via `EventPublisher`:

- `interview.session_started`
- `interview.attempt_submitted` → consumed by ai-service
- `interview.attempt_evaluated`
- `interview.session_completed`
- `interview.retry_item_created`
- `interview.task_skipped`

## Commands

```bash
cd services/interview
make start
make gen-proto
make lint
make test
make build
```

## Env

| Variable | Default |
|----------|---------|
| HTTP_PORT | 8082 |
| GRPC_PORT | 9092 |
| POSTGRES_DSN | `postgres://postgres:postgres@localhost:5434/druzya_interview?sslmode=disable` |
| CONTENT_GRPC_ADDR | `127.0.0.1:9091` |
| JWT_PUBLIC_KEY_FILE | (required, same as identity) |
| INTERNAL_API_TOKEN | (required) |
| SESSION_TTL | `8h` |
| TRAINING_TASK_LIMIT | `10` |
| LOG_LEVEL | info |
