# AGENTS.md — sandbox service

Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/sandbox`

## Purpose

Isolated code execution for live-coding tasks → submit attempt to interview.

## Ports

HTTP `8086` | gRPC `9096` | PG `5439` / `druzya_sandbox`

## API

| RPC | HTTP |
|-----|------|
| RunCode, GetCodeRun, ListCodeRuns | `/v1/sandbox/code-runs` |
| SubmitAttemptFromCodeRun | `POST …/code-runs/{id}/submit-attempt` |
| FormatCode | `POST /v1/sandbox/format` |
| Go LSP | `WS /ws/lsp/go?token=JWT` |

## Run types

`custom` (stdin only) | `sample` (public tests) | `submit` (public + hidden if Pro)

## Runner (`RUNNER_MODE`)

| Mode | Use |
|------|-----|
| `fake` | dev/CI stub |
| `process` | **dev only** — no isolation |
| `docker` | **production required** — container per run |

Prod host needs `/var/lib/sandbox-work` bind-mount + Docker socket. See [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md).

## Commands

```bash
cd services/sandbox
make gen-proto | start | test | lint
```

Env: JWT public key, `CONTENT_GRPC_ADDR`, `INTERVIEW_GRPC_ADDR`, `BILLING_GRPC_ADDR`, `SANDBOX_*` limits.
