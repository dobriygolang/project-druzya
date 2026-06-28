# AGENTS.md — admin service

Stateless BFF for operator UI. Work from `services/admin/` only.

Module: `github.com/sedorofeevd/project-druzya/services/admin`

Design notes: [../../docs/architecture/admin-panel.md](../../docs/architecture/admin-panel.md)

## Purpose

`/v1/admin/*` — JWT + `ADMIN_USER_IDS` allowlist, proxy to content/billing/ai with server-side tokens.

No Postgres.

## Ports

HTTP `8088` | gRPC `9098`

## Auth

1. Bearer JWT (identity RS256)
2. `sub` ∈ `ADMIN_USER_IDS`
3. Downstream tokens never exposed to browser

## API groups

| Area | Routes |
|------|--------|
| Session / dashboard | `/v1/admin/session`, `/dashboard` |
| Content CRUD | `/v1/admin/content/*` — companies, tasks, articles, templates |
| Billing | `/v1/admin/billing/*` — plans, grant/revoke |
| AI / LLM | `/v1/admin/ai/*` — eval jobs, config, probe |

Full route list: `api/admin/v1/admin.proto`.

## Commands

```bash
cd services/admin
make gen-proto | run | lint | build
```

## Dev env

```bash
export JWT_PUBLIC_KEY_FILE=../identity/scripts/dev/jwt/public.pem
export ADMIN_USER_IDS=<uuid>
export CONTENT_ADMIN_TOKEN=dev-admin-token
export INTERNAL_API_TOKEN=dev-internal-token
export CONTENT_GRPC_ADDR=127.0.0.1:9091
export BILLING_GRPC_ADDR=127.0.0.1:9095
export AI_GRPC_ADDR=127.0.0.1:9093
make run
```

Prod: Caddy `handle /v1/admin/*` → `admin:8088`.
