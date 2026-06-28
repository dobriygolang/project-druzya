# AGENTS.md — recommendation service

Work from `services/recommendation/` only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/recommendation`

## Purpose

Interview outbox → skill profiles → recommendations, learning plan, **daily brief**, **mock progress** (task/template/mode activity).

Does not call ai-service.

## Ports

HTTP `8084` | gRPC `9094` | PG `5436` / `druzya_recommendation`

## Mock progress

Tables: `user_task_progress`, `user_template_progress`, `user_practice_mode_activity` (migration `00002_user_mock_progress.sql`).

| Event | Progress effect |
|-------|-----------------|
| `attempt_evaluated` | upsert task + mode activity |
| `session_completed` | upsert template progress (company mock) |

| RPC | HTTP / internal |
|-----|-----------------|
| GetMockHubContext | `GET /v1/recommendations/mock-hub` |
| GetTaskPickerHints | internal gRPC (`RecommendationInternalService`) |

Full design: [docs/architecture/mock-progress.md](../../docs/architecture/mock-progress.md).

## Outbox worker

Poll interview internal API (`WORKER_POLL_INTERVAL`, 2s) **or** subscribe via NATS when `NATS_URL` set and `OUTBOX_POLL_ENABLED=false`. **Never use `OutboxClaimAll` (`*`).**

| Event | Effect |
|-------|--------|
| `interview.attempt_evaluated` | skills, readiness, improve_skill, **task progress** |
| `interview.session_completed` | mock rec if readiness≥80, **template progress** |
| `interview.retry_item_created` | retry_task plan item |
| `interview.task_skipped` | ensure profile exists |

Idempotency: `processed_events(consumer, event_id)`.

## Daily brief + articles

`GetDashboard` builds `daily_brief.items[]` from plan, retries, weaknesses, articles, **stale practice modes**.

`article_reads(user_id, article_slug)` — `MarkArticleRead` from web.

## API

| RPC | HTTP |
|-----|------|
| GetDashboard | `GET /v1/recommendations/dashboard` |
| GetMockHubContext | `GET /v1/recommendations/mock-hub` |
| MarkArticleRead | `POST /v1/recommendations/articles/{slug}/read` |
| Dismiss/Complete recommendation | `POST /v1/recommendations/{id}/…` |
| Complete/Dismiss learning plan item | `POST /v1/recommendations/learning-plan/{id}/…` |

## Commands

```bash
cd services/recommendation
make start | gen-proto | test | lint | build
```

## Env

JWT public key, `INTERNAL_API_TOKEN`, `INTERVIEW_GRPC_ADDR`, `CONTENT_GRPC_ADDR`, `WORKER_POLL_INTERVAL`, `NATS_URL`, `OUTBOX_POLL_ENABLED`.
