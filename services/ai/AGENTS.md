# AGENTS.md — ai service

Self-contained. Work from `services/ai/` only.

Module: `github.com/sedorofeevd/project-druzya/services/ai`

## Purpose

AI eval for interview attempts. Consume `interview.attempt_submitted` outbox → content rubric bundle → LLM score → interview `CompleteEvaluation`.

**Not own:** users/auth, catalog, sessions, billing.

| Q | Owner |
|---|-------|
| task/rubric | content `GetTaskBundle` |
| user answer | interview `GetAttemptInternal` |
| score | **ai** |
| persist result | interview `CompleteEvaluation` |

## Ports

HTTP `8083` | gRPC `9093` | PG `5435` `druzya_ai` | interview gRPC `127.0.0.1:9092` | content `127.0.0.1:9091`

## Layout

```
cmd/ai/app/           DI + server + worker
api/ai/v1/            proto
internal/evaluation/  model, repository, service, evaluator (2-pass judge + llmchain)
internal/outboxworker/
internal/adapter/     interview, content, llm/llmchain
internal/app/api/ai/
scripts/migrations/
```

## Tables

`evaluation_jobs` (attempt_id UNIQUE) | `model_calls` (LLM audit)

Job status: `pending` | `running` | `completed` | `failed`

## API

| RPC | HTTP | Auth |
|-----|------|------|
| RunEvaluation | gRPC | `x-internal-token` |
| GetEvaluationJob | `GET /v1/admin/evaluation-jobs/{id}` | internal |
| ListEvaluationJobs | `GET /v1/admin/evaluation-jobs` | internal |

## Worker

Poll `ClaimOutboxEvents(event=interview.attempt_submitted)` every `WORKER_POLL_INTERVAL` (default 2s). Ack ok / Fail err. Structured logs: `outbox_processed`, `outbox_failed` + duration_ms.

## Pipeline

1. claim outbox
2. `RunEvaluation` → content bundle + interview attempt
3. 2-pass judge: pass1 water (skip code) → pass2 rubric + `criteria[]` in feedback
4. **caveman** (`llmchain/caveman`) compress prompts before external LLM — `LLM_CAVEMAN=lite|full|off`
5. `model_calls` rows
6. `CompleteEvaluation`

## Mocks

`//go:generate mockery` on interfaces. `make gen-mocks`

## Commands

```bash
cd services/ai
export INTERNAL_API_TOKEN=dev-internal-token
make start | gen-proto | test | lint | build
```

## Env

`HTTP_PORT` `8083` | `GRPC_PORT` `9093` | `POSTGRES_DSN` localhost:5435 | `INTERVIEW_GRPC_ADDR` | `CONTENT_GRPC_ADDR` | `INTERNAL_API_TOKEN` (req) | `LLM_CHAIN_ORDER` | API keys optional (fake LLM if none) | `LLM_CAVEMAN` `lite` (`off`/`full`) | `EVAL_MAX_RETRIES` `3` | `WORKER_POLL_INTERVAL` `2s`

Build: `GOWORK=off`

## Agent tokens (cavecrew)

Read `.cursor/rules/cavecrew.mdc`. Broad locate → `cavecrew-investigator`. ≤2 file edit → `cavecrew-builder`. Diff review → `cavecrew-reviewer`.

Human backup: `AGENTS.original.md`
