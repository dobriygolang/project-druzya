# AGENTS.md — admin service

Self-contained BFF for operator UI. Work from `services/admin/` only.

Module: `github.com/sedorofeevd/project-druzya/services/admin`

## Purpose

HTTP gateway for `/v1/admin/*`. Validates JWT + `ADMIN_USER_IDS` allowlist, then proxies to downstream gRPC with server-side tokens (never exposed to browser).

| Area | Downstream | Token |
|------|------------|-------|
| Content catalog | content gRPC | `CONTENT_ADMIN_TOKEN` / `ADMIN_API_TOKEN` → `x-admin-token` |
| **Billing (phase 3)** | billing gRPC | `INTERNAL_API_TOKEN` |
| LLM config (phase 4) | ai gRPC | `INTERNAL_API_TOKEN` |

No own Postgres in MVP — stateless BFF.

## Ports

HTTP `8088` | gRPC `9098`

## Layout

```
cmd/admin/app/              DI + server
api/admin/v1/admin.proto
internal/admin/service/     orchestration
internal/adapter/content/   content read + admin write client
internal/app/api/admin/     transport (one RPC per file)
internal/config/
internal/tools/
```

Design doc: [../../docs/architecture/admin-panel.md](../../docs/architecture/admin-panel.md)

## Auth

1. `Authorization: Bearer <JWT>` (same RS256 as identity)
2. `sub` must be in env `ADMIN_USER_IDS` (comma-separated UUIDs)
3. Non-allowlisted users → `403 PermissionDenied`

## API (phase 0–2)

| RPC | HTTP |
|-----|------|
| GetSession | `GET /v1/admin/session` |
| GetDashboard | `GET /v1/admin/dashboard` |
| ListCompanies | `GET /v1/admin/content/companies` |
| UpsertCompany | `POST /v1/admin/content/companies` |
| ListTasks | `GET /v1/admin/content/tasks` |
| GetTask | `GET /v1/admin/content/tasks/{id}` or `/by-slug/{slug}` — includes `solutions[]` |
| UpsertTask | `POST /v1/admin/content/tasks` |
| ReplaceTaskSolutions | `POST /v1/admin/content/tasks/{task_id}/solutions` |
| ListArticles | `GET /v1/admin/content/articles` |
| GetArticle | `GET /v1/admin/content/articles/{id}` or `/by-slug/{slug}` — includes `linked_tasks` |
| UpsertArticle | `POST /v1/admin/content/articles` — optional `task_slugs[]` (catalog task slugs) |
| ListInterviewTemplates | `GET /v1/admin/content/interview-templates` |
| GetInterviewTemplateDetail | `GET /v1/admin/content/interview-templates/{id}/detail` or `/by-slug/{slug}/detail` |
| UpsertInterviewTemplate | `POST /v1/admin/content/interview-templates` |
| UpsertTemplateSection | `POST /v1/admin/content/interview-templates/sections` |
| ReplaceTemplateStructure | `POST /v1/admin/content/interview-templates/{template_id}/structure` |
| ListPlans | `GET /v1/admin/billing/plans` |
| GetUserEntitlements | `GET /v1/admin/billing/users/{user_id}/entitlements` |
| GrantSubscription | `POST /v1/admin/billing/subscriptions/grant` |
| RevokeSubscription | `POST /v1/admin/billing/subscriptions/revoke` |
| ListEvaluationJobs | `GET /v1/admin/ai/evaluation-jobs` |
| GetEvaluationJob | `GET /v1/admin/ai/evaluation-jobs/{id}` |
| GetLLMConfig | `GET /v1/admin/ai/llm/config` |
| UpdateLLMConfig | `PUT /v1/admin/ai/llm/config` |
| ProbeLLMProviders | `POST /v1/admin/ai/llm/probe` |

## Commands

```bash
cd services/admin
make gen-proto
make run
make lint
make build
```

## Env

| Variable | Required | Default |
|----------|----------|---------|
| JWT_PUBLIC_KEY / JWT_PUBLIC_KEY_FILE | yes | same as identity |
| ADMIN_USER_IDS | yes | comma-separated UUIDs |
| CONTENT_ADMIN_TOKEN or ADMIN_API_TOKEN | yes | content admin gRPC |
| CONTENT_GRPC_ADDR | no | `127.0.0.1:9091` |
| IDENTITY_GRPC_ADDR | no | `127.0.0.1:9090` |
| BILLING_GRPC_ADDR | no | `127.0.0.1:9095` |
| INTERNAL_API_TOKEN | yes | billing + ai internal gRPC |
| AI_GRPC_ADDR | no | `127.0.0.1:9093` |
| HTTP_PORT | no | `8088` |
| GRPC_PORT | no | `9098` |
| CORS_ALLOWED_ORIGINS | no | empty |
| LOG_LEVEL | no | `info` |

## Dev

```bash
export JWT_PUBLIC_KEY_FILE=../identity/scripts/dev/jwt/public.pem
export ADMIN_USER_IDS=<your-user-uuid>
export CONTENT_ADMIN_TOKEN=dev-admin-token   # must match content ADMIN_API_TOKEN
export CONTENT_GRPC_ADDR=127.0.0.1:9091
export IDENTITY_GRPC_ADDR=127.0.0.1:9090
export BILLING_GRPC_ADDR=127.0.0.1:9095
export AI_GRPC_ADDR=127.0.0.1:9093
export INTERNAL_API_TOKEN=dev-internal-token   # must match billing + ai INTERNAL_API_TOKEN
make run
```

## Caddy / Vite

- Prod: `deploy/Caddyfile` → `handle /v1/admin/*` → `admin:8088`
- Dev: `apps/web/vite.config.ts` proxies `/v1/admin` → `:8088`
