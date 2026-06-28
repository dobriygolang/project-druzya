# AGENTS.md — ai service

Self-contained. Work from `services/ai/` only.

Module: `github.com/sedorofeevd/project-druzya/services/ai`

## Purpose

AI eval for interview attempts. Consume `interview.attempt_submitted` outbox → content rubric bundle → LLM score → interview `CompleteEvaluation` or `FailEvaluation`.

**Not own:** users/auth, catalog, sessions, billing (consumes quota only).

| Q | Owner |
|---|-------|
| task/rubric | content `GetTaskBundle` |
| user answer | interview `GetAttemptInternal` |
| score | **ai** |
| persist result | interview `CompleteEvaluation` |
| permanent failure | interview `FailEvaluation` |

## Ports

HTTP `8083` | gRPC `9093` | PG `5435` `druzya_ai` | interview gRPC `127.0.0.1:9092` | content `127.0.0.1:9091` | billing gRPC optional

## Layout

```
cmd/ai/app/           DI + server + outbox worker + retry worker
api/ai/v1/            proto
internal/evaluation/
  model/ repository/ service/
  usecase/command/run_evaluation/   — eval pipeline + billing consume
  evaluator/                        — 2-pass judge + llmchain
internal/outboxworker/              — interview.attempt_submitted
internal/retryworker/               — delayed retries + stuck running recovery
internal/adapter/     interview, content, billing, llm/llmchain
internal/app/api/ai/
scripts/migrations/
```

## Tables

`evaluation_jobs` (attempt_id UNIQUE) | `model_calls` (LLM audit)

Job status: `pending` | `running` | `completed` | `failed`

## API

| RPC | HTTP | Auth |
|-----|------|------|
| RunEvaluation | gRPC only | `x-internal-token` |
| GetEvaluationJob | `GET /v1/admin/evaluation-jobs/{id}` | internal |
| ListEvaluationJobs | `GET /v1/admin/evaluation-jobs` | internal |
| GetLLMConfig | `GET /v1/admin/llm/config` | internal |
| UpdateLLMConfig | `PUT /v1/admin/llm/config` | internal |

## Workers

### Outbox worker (`internal/outboxworker`)

Poll `ClaimOutboxEvents(event=interview.attempt_submitted)` every `WORKER_POLL_INTERVAL` (default 2s).
Ack on success / Fail on error. Logs: `outbox_processed`, `outbox_failed` (include `attempt_id`).

Prometheus: `outbox_lag_seconds`, `outbox_handler_duration_seconds`. Interview internal calls propagate `x-attempt-id` (`internal/tools/correlation/`).

### Retry worker (`internal/retryworker`)

- Re-runs `RunEvaluation` for jobs with `next_retry_at <= now`
- Resets jobs stuck in `running` longer than `StuckTimeout` (default 10m)
- Interval default 30s

Do **not** claim outbox events other than `attempt_submitted`.

## Pipeline (`run_evaluation`)

1. Idempotent job row (`evaluation_jobs`)
2. `CheckAndConsumeUsage` (`ai_evaluations_per_day`) only when `RetryCount == 0`
3. content `GetTaskBundle` + interview `GetAttemptInternal`
4. 2-pass judge: pass1 water (skip code) → pass2 rubric + `criteria[]` in feedback
5. **caveman** (`llmchain/caveman`) — `LLM_CAVEMAN=lite|full|off`
6. Persist `model_calls`
7. Success → interview `CompleteEvaluation`
8. Permanent failure (retries exhausted) → `ReleaseUsage` (idempotent by `attempt_id`) + interview `FailEvaluation`

## Mocks

`//go:generate mockery` on interfaces. `make gen-mocks`

## Commands

```bash
cd services/ai
export INTERNAL_API_TOKEN=dev-internal-token
make start | gen-proto | test | lint | build
```

## Env

| Variable | Default |
|----------|---------|
| HTTP_PORT | 8083 |
| GRPC_PORT | 9093 |
| POSTGRES_DSN | localhost:5435 / `druzya_ai` |
| INTERVIEW_GRPC_ADDR | `127.0.0.1:9092` |
| CONTENT_GRPC_ADDR | `127.0.0.1:9091` |
| BILLING_GRPC_ADDR | optional |
| INTERNAL_API_TOKEN | required |
| LLM_CHAIN_ORDER | free chain fallback if `LLM_FREE_CHAIN_ORDER` empty |
| LLM_FREE_CHAIN_ORDER | free users (`groq,cloudflare,openrouter`) |
| LLM_PAID_CHAIN_ORDER | pro users (`deepseek,groq`) |
| GROQ_API_KEY | free-tier Groq |
| GROQ_PAID_API_KEY | paid Groq (Developer tier) |
| DEEPSEEK_API_KEY | paid chain only |
| OPENROUTER_PAID_API_KEY | optional paid fallback |
| LLM_CAVEMAN | `lite` (`off` / `full`) |
| EVAL_MAX_RETRIES | `3` |
| EVAL_WORKER_CONCURRENCY | `1` (raise to 10–30 with paid API) |
| WORKER_POLL_INTERVAL | `2s` |
| DEEPSEEK_API_KEY | optional; paid judge primary — see `deploy/RUNBOOK.md` |

Build: `GOWORK=off`

## Agent tokens (cavecrew)

Read `.cursor/rules/cavecrew.mdc`. Broad locate → `cavecrew-investigator`. ≤2 file edit → `cavecrew-builder`. Diff review → `cavecrew-reviewer`.
