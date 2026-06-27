# AGENTS.md — ai service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/ai`

## Purpose

AI **evaluation** for interview attempts: consumes `interview.attempt_submitted` outbox events, calls content for task/rubric bundle, runs LLM scoring, completes evaluation via interview internal API.

Does **not** own: users/auth, catalog, interview sessions, billing.

| Question | Service |
|----------|---------|
| What is the task/rubric? | content (`GetTaskBundle`) |
| What did user submit? | interview (`GetAttemptInternal`) |
| How to score? | **ai** |
| Persist session score? | interview (`CompleteEvaluation`) |

## Ports

| Protocol | Default |
|----------|---------|
| HTTP | 8083 |
| gRPC | 9093 |
| Postgres | 5435 (`druzya_ai`) |
| Interview gRPC | `127.0.0.1:9092` |
| Content gRPC | `127.0.0.1:9091` |

## Layout

```
cmd/ai/app/                  DI, API server, outbox worker
api/ai/v1/
pkg/api/ai/v1/               — generated
pkg/client/                  — InternalClient port
internal/evaluation/
  model/                     — EvaluationJob, ModelCall
  repository/                — postgres
  service/                   — Service interface + RunEvaluation
  evaluator/                 — 2-pass judge (water + score) via llmchain
internal/outboxworker/       — poll + Ack/Fail (testable without gRPC init)
internal/adapter/
  interview/                 — Client port + interview/grpc gRPC impl
  content/                   — Client port + content/grpc gRPC impl
  llm/                       — BuildChain wiring
  llm/llmchain/              — ported druzya provider chain (fallback, multi-key)
internal/app/api/ai/         — AiInternalService transport
internal/config/
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Tables

- `evaluation_jobs` — one job per attempt (`attempt_id` UNIQUE)
- `model_calls` — LLM audit trail per job

## Job status

`pending` | `running` | `completed` | `failed`

## API (internal gRPC + optional HTTP admin)

| RPC | HTTP | Auth |
|-----|------|------|
| RunEvaluation | gRPC only | `x-internal-token` |
| GetEvaluationJob | `GET /v1/admin/evaluation-jobs/{id}` | `x-internal-token` |
| ListEvaluationJobs | `GET /v1/admin/evaluation-jobs` | `x-internal-token` |

## Worker

`internal/outboxworker` polls interview `ClaimOutboxEvents(event=interview.attempt_submitted)` every `WORKER_POLL_INTERVAL` (default 2s). On success `AckOutboxEvents`; on failure `FailOutboxEvent`.

## Evaluation pipeline

1. Worker claims outbox event
2. `RunEvaluation` → content `GetTaskBundle` + interview `GetAttempt`
3. **2-pass judge** (`evaluator.LLMJudge`):
   - Pass 1: off-topic / water score (skipped for code submissions)
   - Pass 2: rubric scoring → `final = correctness × (1 - water/100 × penalty)`
4. Each pass → `model_calls` row
5. `CompleteEvaluation` on interview

## Mocks (mockery)

`//go:generate mockery` lives on interface definitions (same as search-performance), not separate `generate.go` files.

```bash
make gen-mocks
```

## Commands

```bash
cd services/ai
export INTERNAL_API_TOKEN=dev-internal-token
make start
make gen-proto
make test
make lint
make build
```

## Env

| Variable | Default |
|----------|---------|
| HTTP_PORT | 8083 |
| GRPC_PORT | 9093 |
| POSTGRES_DSN | `postgres://postgres:postgres@localhost:5435/druzya_ai?sslmode=disable` |
| INTERVIEW_GRPC_ADDR | `127.0.0.1:9092` |
| CONTENT_GRPC_ADDR | `127.0.0.1:9091` |
| INTERNAL_API_TOKEN | (required) |
| LLM_CHAIN_ORDER | `groq,cerebras,openai,google` |
| GROQ_API_KEY / CEREBRAS_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY | optional (fake LLM when none) |
| EVAL_MAX_RETRIES | `3` |
| WORKER_POLL_INTERVAL | `2s` |
| LOG_LEVEL | info |

## Dependencies

`go.mod` replaces `../content` and `../interview` for gRPC clients. Build with `GOWORK=off`.
