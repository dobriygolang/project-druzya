# AGENTS.md — interview service

Work from this directory only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/interview`

## Purpose

Interview **runtime**: sessions, tasks, attempts, scores, retry queue, **domain_outbox**.

Does not own: auth, catalog, AI calls, billing (uses adapters).

## Ports

HTTP `8082` | gRPC `9092` | PG `5434` / `druzya_interview` | content `9091` | billing optional

## Tables

`sessions`, `session_sections`, `session_tasks` (snapshot `task_title`, `task_type`), `attempts`, `evaluation_summaries`, `retry_items`, `domain_outbox`.

One active session per user (partial unique index).

## Outbox

Written in same tx as domain mutations. Consumers claim via internal gRPC — **no direct DB access**.

| Event | Consumer |
|-------|----------|
| `interview.attempt_submitted` | ai |
| `interview.attempt_evaluated`, `session_completed`, `retry_item_created`, `task_skipped` | recommendation |

Each worker claims **only its event types** (not `*`). Future bus relay: [docs/architecture/outbox-relay.md](../../docs/architecture/outbox-relay.md).

## API (HTTP)

| RPC | HTTP |
|-----|------|
| StartInterviewSession | `POST /v1/interview/sessions` |
| GetCurrentSessionState, GetSessionResults | `GET …/current`, `GET …/results` |
| SubmitAttempt, SkipTask | `POST …/attempts`, `POST …/skip` |
| ListRetryItems, StartRetrySession | `GET/POST retry-items, retry-sessions` |

Code tasks: frontend submits via sandbox `SubmitAttemptFromCodeRun` after successful `submit` run.

Internal RPCs (`x-internal-token`): `GetAttemptInternal`, `CompleteEvaluation`, `FailEvaluation`, outbox claim/ack — used by ai and recommendation.

## Billing

`StartInterviewSession`: company template gate + consume `mock_interviews_per_month` after session created.

## Commands

```bash
cd services/interview
make start | gen-proto | lint | test | build
```

## Env

`JWT_PUBLIC_KEY_FILE`, `INTERNAL_API_TOKEN`, `CONTENT_GRPC_ADDR`, `BILLING_GRPC_ADDR`, `SESSION_TTL` (8h), `TRAINING_TASK_LIMIT` (10).

Domain enums: map in `internal/app/api/interview/proto_enums.go`.
