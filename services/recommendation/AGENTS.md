# AGENTS.md — recommendation service

Work from `services/recommendation/` only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/recommendation`

## Purpose

Interview outbox → skill profiles → recommendations, learning plan, **daily brief** (Today page).

Does not call ai-service.

## Ports

HTTP `8084` | gRPC `9094` | PG `5436` / `druzya_recommendation`

## Outbox worker

Poll interview internal API (`WORKER_POLL_INTERVAL`, 2s) **or** subscribe via NATS when `NATS_URL` set and `OUTBOX_POLL_ENABLED=false`. **Never use `OutboxClaimAll` (`*`).**

| Event | Effect |
|-------|--------|
| `interview.attempt_evaluated` | skills, readiness, improve_skill |
| `interview.session_completed` | mock interview rec if readiness≥80 |
| `interview.retry_item_created` | retry_task plan item |
| `interview.task_skipped` | ensure profile exists |

Idempotency: `processed_events(consumer, event_id)`.

## Daily brief + articles

`GetDashboard` builds `daily_brief.items[]` from readiness, weaknesses, plan, retries, content articles.

`article_reads(user_id, article_slug)` — `MarkArticleRead` from web; affects brief and catalog badges.

## API

| RPC | HTTP |
|-----|------|
| GetDashboard | `GET /v1/recommendations/dashboard` |
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
