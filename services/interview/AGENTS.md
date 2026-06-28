# AGENTS.md — interview service

Work from this directory only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/interview`

## Purpose

Interview **runtime**: sessions, tasks, attempts, scores, retry queue, **domain_outbox**, **smart task picking**, **session outcome**.

Does not own: auth, catalog, AI calls, billing (uses adapters). **Mock progress** lives in recommendation-service (queried via gRPC).

## Ports

HTTP `8082` | gRPC `9092` | PG `5434` / `druzya_interview` | content `9091` | ai `9093` | billing optional | recommendation `9094`

## Tables

`sessions` (+ `outcome`, `paused`), `session_sections`, `session_tasks`, `attempts`, `evaluation_summaries`, `retry_items`, `domain_outbox`, **`system_design_workspaces`**, **`system_design_turns`**.

One ongoing session per user (`active` or `paused`).

## Task picking

`practice_scope` on `StartInterviewSession`:

| Scope | Pick logic |
|-------|------------|
| `random_one` | Fresh tasks first (exclude passed + pending retry); repeat when catalog covered |
| `company_track` | Same on company template tasks |
| `review` | Tasks passed 14+ days ago (from recommendation hints) |

See [docs/architecture/mock-progress.md](../../docs/architecture/mock-progress.md).

## Outbox

Written in same tx as domain mutations. Consumers claim via internal gRPC — **no direct DB access**.

| Event | Consumer |
|-------|----------|
| `interview.attempt_submitted` | ai |
| `interview.attempt_evaluated`, `session_completed`, `retry_item_created`, `task_skipped` | recommendation |

Payload extras: `attempt_evaluated` → `mode`, `template_id`; `session_completed` → `template_id`, `outcome`, `passing_score`.

Each worker claims **only its event types** (not `*`). Future bus relay: [docs/architecture/outbox-relay.md](../../docs/architecture/outbox-relay.md).

## API (HTTP)

| RPC | HTTP |
|-----|------|
| StartInterviewSession | `POST /v1/interview/sessions` |
| PauseSession / ResumeSession | `POST …/pause`, `POST …/resume` |
| CancelSession | `POST …/cancel` |
| GetCurrentSessionState, GetSessionResults | `GET …/current`, `GET …/results` |
| SubmitAttempt, SkipTask | `POST …/attempts`, `POST …/skip` |
| **System design room** | `GET/PATCH …/system-design/workspace`, `GET/POST …/turns`, `POST …/checkpoint`, `POST …/submit` |
| ListRetryItems, StartRetrySession | `GET/POST retry-items, retry-sessions` |

Code tasks: frontend submits via sandbox `SubmitAttemptFromCodeRun` after successful `submit` run.

**System design** tasks use `/interview/session/:id/design` (not textarea `SubmitAttempt`). Workspace autosave + AI turns via ai-service (`sd_ai_turns_per_month` per chat/checkpoint). Final submit packs JSON dossier + optional diagram PNG → `attempt_submitted` → ai SD evaluator. Spec: [docs/architecture/system-design-room.md](../../docs/architecture/system-design-room.md).

Internal RPCs (`x-internal-token`): `GetAttemptInternal`, `CompleteEvaluation`, `FailEvaluation`, `CompleteRetryItemInternal`, outbox claim/ack — used by ai and recommendation.

## Billing

`StartInterviewSession`: company template gate + consume `mock_interviews_per_month` after session created. **Pause** releases quota; **resume** re-consumes.

## Commands

```bash
cd services/interview
make start | gen-proto | lint | test | build
```

## Env

`JWT_PUBLIC_KEY_FILE`, `INTERNAL_API_TOKEN`, `CONTENT_GRPC_ADDR`, `AI_GRPC_ADDR`, `BILLING_GRPC_ADDR`, `RECOMMENDATION_GRPC_ADDR`, `SESSION_TTL` (8h), `TRAINING_TASK_LIMIT` (10).

Domain enums: map in `internal/app/api/interview/proto_enums.go`.
