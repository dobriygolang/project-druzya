# AGENTS.md — ai service

Work from `services/ai/` only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/ai`

## Purpose

LLM evaluation for interview attempts. Consumes `interview.attempt_submitted` → content rubric → score → `CompleteEvaluation` / `FailEvaluation`.

Does not own: users, catalog, sessions (consumes billing quota only).

## Ports

HTTP `8083` | gRPC `9093` | PG `5435` / `druzya_ai`

## Tables

`evaluation_jobs` (unique `attempt_id`) | `model_calls` | `llm_runtime_config`

## Workers

- **Outbox** — claim `interview.attempt_submitted` only; poll `WORKER_POLL_INTERVAL` (2s)
- **Retry** — jobs with `next_retry_at`; reset stuck `running` (10m)

Metrics: `outbox_lag_seconds`, `outbox_handler_duration_seconds`, `llm_*`, `llm_prompt_cache_*`.

## Pipeline (`run_evaluation`)

1. Idempotent job row
2. `CheckAndConsumeUsage` on first attempt only (`ai_evaluations_per_day`)
3. content `GetTaskBundle` + interview `GetAttemptInternal`
4. 2-pass judge + optional caveman compression (`LLM_CAVEMAN`)
5. Prompt cache (`LLM_PROMPT_CACHE=on`) — SHA-256 LRU + optional Redis L2
6. `CompleteEvaluation` or permanent fail → `ReleaseUsage` + `FailEvaluation`

## API

Internal only (`x-internal-token`): `RunEvaluation`, admin eval jobs, `GetLLMConfig` / `UpdateLLMConfig`.

HTTP admin routes under `/v1/admin/ai/*` (via admin BFF).

## Commands

```bash
cd services/ai
export INTERNAL_API_TOKEN=dev-internal-token
make start | gen-proto | gen-mocks | test | lint | build
```

## Env

| Variable | Notes |
|----------|-------|
| INTERNAL_API_TOKEN | required |
| INTERVIEW_GRPC_ADDR / CONTENT_GRPC_ADDR | `127.0.0.1:9092` / `9091` |
| BILLING_GRPC_ADDR | optional |
| LLM_FREE_CHAIN_ORDER / LLM_PAID_CHAIN_ORDER | plan-based routing — see [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md) |
| GROQ_API_KEY, DEEPSEEK_API_KEY, … | provider keys |
| LLM_PROMPT_CACHE, REDIS_ADDR | cache |
| EVAL_MAX_RETRIES, EVAL_WORKER_CONCURRENCY, WORKER_POLL_INTERVAL | worker tuning |
| NATS_URL, OUTBOX_POLL_ENABLED | bus consumer when relay enabled (`false` in prod compose) |

Build: `GOWORK=off`
