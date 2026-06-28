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
| FormatCode | `POST /v1/sandbox/format` | Bearer JWT |
| Go LSP (gopls) | `GET /ws/lsp/go?token=JWT` | JWT query param |

WebSocket `/ws/lsp/go` proxies JSON-RPC to per-session `gopls` (`SANDBOX_GOPLS_PATH`, default `gopls`).

## Run types

- `custom` — stdin only, no task tests
- `sample` — public examples + non-hidden test_cases
- `submit` — public + hidden tests (hidden failures redacted)

## Runner modes (`RUNNER_MODE`)

| Mode | Use | Isolation |
|------|-----|-----------|
| `fake` | Default dev/CI — deterministic stub | none |
| `process` | Local subprocess in temp dir | **none — host execution, dev only** |
| `docker` | Container per run | network off, mem/cpu/pids limits, `--cap-drop ALL`, `--read-only` + tmpfs, `no-new-privileges`, killed on timeout |

**Production guards:** the service refuses to start unless `RUNNER_MODE=docker`
when `APP_ENV=production`. `process` runs untrusted code directly on the host and
must never be used outside local dev. Docker requires the host docker daemon.

## Input limits

`SANDBOX_MAX_CODE_BYTES` (128KiB), `SANDBOX_MAX_STDIN_BYTES` (64KiB),
`SANDBOX_MAX_TESTS` (50), per-run `SANDBOX_DEFAULT_TIMEOUT_MS`,
`SANDBOX_DEFAULT_MEMORY_MB`, `SANDBOX_DEFAULT_CPUS`.

`SubmitAttemptFromCodeRun` only accepts a successful `submit`-type run.

**Code task submit flow:** frontend runs FULL (`run_type=submit`) → on success calls `SubmitAttemptFromCodeRun` → interview persists attempt + outbox. Direct interview code submit from the session UI is not used.

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
- `CONTENT_GRPC_ADDR`, `INTERVIEW_GRPC_ADDR`, `BILLING_GRPC_ADDR` (optional)
- `RUNNER_MODE`, `SANDBOX_MAX_OUTPUT_BYTES`, `SANDBOX_DEFAULT_TIMEOUT_MS`
- `SANDBOX_DEFAULT_MEMORY_MB`, `SANDBOX_DEFAULT_CPUS`
- `SANDBOX_MAX_CODE_BYTES`, `SANDBOX_MAX_STDIN_BYTES`, `SANDBOX_MAX_TESTS`
- `SANDBOX_DOCKER_GO_IMAGE`, `SANDBOX_DOCKER_PYTHON_IMAGE`, `SANDBOX_DOCKER_NODE_IMAGE`
