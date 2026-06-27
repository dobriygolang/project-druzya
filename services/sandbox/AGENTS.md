# AGENTS.md — sandbox service

Monorepo index: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/sandbox`

## Purpose

Isolated code execution for live-coding tasks. Users run Go/Python/JavaScript against public or hidden tests from content metadata, then submit attempts to interview-service.

**Owns:** code runs, execution results, runner adapter selection.

**Does not own:** users/auth (identity JWT), tasks/tests source of truth (content), attempts (interview), AI eval, recommendations.

## Ports

| Protocol | Value |
|----------|-------|
| HTTP | 8086 |
| gRPC | 9096 |
| Postgres | 5439 / `druzya_sandbox` |

## API

| RPC | HTTP | Auth |
|-----|------|------|
| RunCode | `POST /v1/sandbox/code-runs` | Bearer JWT |
| GetCodeRun | `GET /v1/sandbox/code-runs/{id}` | Bearer JWT |
| ListCodeRuns | `GET /v1/sandbox/code-runs` | Bearer JWT |
| SubmitAttemptFromCodeRun | `POST /v1/sandbox/code-runs/{id}/submit-attempt` | Bearer JWT |

## Run types

- `custom` — stdin only, no task tests
- `sample` — public examples + non-hidden test_cases
- `submit` — public + hidden tests (hidden failures redacted)

## Runner modes (`RUNNER_MODE`)

| Mode | Use |
|------|-----|
| `fake` | Default dev/CI — deterministic stub |
| `process` | Local subprocess in temp dir (dev only) |
| `docker` | Stub — not implemented yet |

## Commands

```bash
cd services/sandbox
make gen-proto
make start
make test
make lint
```

## Env

- `JWT_PUBLIC_KEY` / `JWT_PUBLIC_KEY_FILE`
- `CONTENT_GRPC_ADDR`, `INTERVIEW_GRPC_ADDR`
- `RUNNER_MODE`, `SANDBOX_MAX_OUTPUT_BYTES`, `SANDBOX_DEFAULT_TIMEOUT_MS`
