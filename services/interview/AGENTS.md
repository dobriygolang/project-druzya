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
| Billing gRPC | optional (`internal/adapter/billing`) |

## Layout

```
cmd/interview/
api/interview/v1/
pkg/api/interview/v1/       — generated
pkg/client/                 — Client (user-facing) + InternalClient (ai, recommendation)
internal/interview/
  model/                    — entities + enums
  repository/               — postgres (+ domain_outbox)
  service/                  — Service interface; wires CQRS handlers
  usecase/command/
    submit_attempt/         — SubmitAttempt + outbox attempt_submitted
    complete_evaluation/    — CompleteEvaluation + outbox evaluated/session/retry
    fail_evaluation/        — FailEvaluation (stuck evaluating → failed, reopen task)
internal/adapter/
  content/                  — ContentClient port + gRPC impl
  billing/                  — mock interviews quota + company template gate
  events/                   — EventPublisher (logger only for non-durable events)
internal/app/api/interview/ — gRPC/HTTP transport (one RPC per file)
internal/config/
internal/tools/
scripts/migrations/
scripts/dev/docker-compose.yml
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
- `session_tasks` — `task_id` references content (no FK); snapshot `task_title`, `task_type` at session start
- `attempts` — unique per `session_task_id`
- `evaluation_summaries` — user-facing score (1:1 attempt)
- `retry_items` — failed tasks queue
- `domain_outbox` — durable cross-service events (transactional with domain writes)

## Outbox (multi-consumer)

`domain_outbox` is written in the same transaction as domain mutations.

| Event | When | Consumer | Claim filter |
|-------|------|----------|--------------|
| `interview.attempt_submitted` | SubmitAttempt | **ai-service** | `interview.attempt_submitted` |
| `interview.attempt_evaluated` | CompleteEvaluation | **recommendation-service** | per event name |
| `interview.session_completed` | session fully scored | **recommendation-service** | per event name |
| `interview.retry_item_created` | new retry item on fail | **recommendation-service** | per event name |
| `interview.task_skipped` | SkipTask (also emits `session_completed` when last task) | **recommendation-service** | per event name |

Consumers claim via internal gRPC (`ClaimOutboxEvents` / `AckOutboxEvents` / `FailOutboxEvent`) — **no direct DB access**.

- **ai-service** must claim only `interview.attempt_submitted` (not `*`).
- **recommendation-service** must claim only its four event types (not `*` — races with ai).

`OutboxClaimAll` (`event_name="*"`) exists for tooling; do not use it from competing workers.

Future: message-bus relay — see [docs/architecture/outbox-relay.md](../../../docs/architecture/outbox-relay.md).

Internal eval RPCs accept/propagate `x-attempt-id` metadata for log correlation (see `internal/tools/correlation/`).

## Internal RPCs (`InterviewInternalService`, `x-internal-token`)

| RPC | Used by |
|-----|---------|
| `GetAttemptInternal` | ai |
| `CompleteEvaluation` | ai |
| `FailEvaluation` | ai (permanent eval failure) |
| `GetEvaluationSummaryInternal` | recommendation |
| `ListRetryItemsInternal` | recommendation |
| `ClaimOutboxEvents` / `AckOutboxEvents` / `FailOutboxEvent` | ai, recommendation |

## Content boundary

Use `internal/adapter/content.Client` only:

- `GetInterviewTemplateDetail`
- `GetTask`
- `ListTasks` (training modes)

Never read content postgres tables.

## API (HTTP via grpc-gateway)

| RPC | HTTP | Auth |
|-----|------|------|
| StartInterviewSession | `POST /v1/interview/sessions` | JWT — body: `mode`, optional `practice_scope` (`random_one` \| `company_track`), `company_id` for company track |
| GetInterviewSession | `GET /v1/interview/sessions/{id}` | JWT |
| GetCurrentSessionState | `GET /v1/interview/sessions/{id}/current` | JWT (includes `sections`) |
| GetSessionResults | `GET /v1/interview/sessions/{id}/results` | JWT |
| CancelSession | `POST /v1/interview/sessions/{id}/cancel` | JWT |
| GetActiveSession | `GET /v1/interview/sessions/active` | JWT |
| SubmitAttempt | `POST /v1/interview/session-tasks/{id}/attempts` | JWT |
| SkipTask | `POST /v1/interview/session-tasks/{id}/skip` | JWT |
| GetAttempt | `GET /v1/interview/attempts/{id}` | JWT |
| ListRetryItems | `GET /v1/interview/retry-items` | JWT |
| DismissRetryItem | `POST /v1/interview/retry-items/{id}/dismiss` | JWT |
| StartRetrySession | `POST /v1/interview/retry-sessions` | JWT |

Proto uses typed enums (`SessionMode`, `SessionStatus`, etc.) — map in `internal/app/api/interview/proto_enums.go`.

**Code tasks:** frontend submits via sandbox `SubmitAttemptFromCodeRun` after a successful submit-run (not direct `SubmitAttempt` with raw code).

## Events (non-durable)

Logger only via `EventPublisher` (not in `domain_outbox`):

- `interview.session_started`

## Billing

- `StartInterviewSession`: `CheckEntitlement` (company templates) then `CheckAndConsumeUsage` (`mock_interviews_per_month`) **after** session created; cancel session if quota exceeded.

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
| BILLING_GRPC_ADDR | optional |
| JWT_PUBLIC_KEY_FILE | (required, same as identity) |
| INTERNAL_API_TOKEN | (required) |
| SESSION_TTL | `8h` |
| TRAINING_TASK_LIMIT | `10` |
| LOG_LEVEL | info |
