# AGENTS.md — sandbox service

Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/sandbox`

## Purpose

Isolated code execution for **live coding rooms** (run, fetch result, format).

## Ports

HTTP `8086` | gRPC `9096` | PG `5439` / `druzya_sandbox`

## API

| RPC | HTTP |
|-----|------|
| RunCode | `POST /v1/sandbox/code-runs` |
| GetCodeRun | `GET /v1/sandbox/code-runs/{id}` |
| FormatCode | `POST /v1/sandbox/format` |
| Go LSP | `WS /ws/lsp/go?token=JWT` |

All runs are **`custom`** (language + code + optional stdin). Task-linked `sample`/`submit` modes and content metadata were removed.

## Runner (`RUNNER_MODE`)

| Mode | Use |
|------|-----|
| `fake` | dev/CI stub |
| `process` | **dev only** — no isolation |
| `docker` | **production required** — container per run |

Prod host needs `/var/lib/sandbox-work` bind-mount + Docker socket. See [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md).

## Billing

When `BILLING_GRPC_ADDR` is set, each run consumes `code_runs_per_day` quota.

## Commands

```bash
cd services/sandbox
make gen-proto | start | test | lint
```

Env: JWT public key, `BILLING_GRPC_ADDR`, `SANDBOX_*` limits.
