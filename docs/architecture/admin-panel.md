# Admin panel

Operator UI BFF at `services/admin`. See [services/admin/AGENTS.md](../../services/admin/AGENTS.md).

## Decisions

| Topic | Choice |
|-------|--------|
| Service shape | **`services/admin`** BFF (HTTP only, no domain DB) |
| Auth | JWT + **`ADMIN_USER_IDS`** env allowlist on admin service |
| Content writes | Granular RPC + **`ReplaceTemplateStructure`** (phase 2) for template wizard |
| LLM runtime config | Stored in **ai DB** only; admin BFF proxies ai internal RPC (phase 4) |

## Architecture

```
apps/web /admin  →  GET/POST /v1/admin/*  →  services/admin
                                              ├─ JWT + allowlist
                                              ├─ identity gRPC (user stats)
                                              ├─ content gRPC (x-admin-token)
                                              ├─ billing gRPC (phase 3)
                                              └─ ai gRPC (phase 4)
```

Secrets (`CONTENT_ADMIN_TOKEN`, `INTERNAL_API_TOKEN`) stay on admin service — never in browser.

## Phases

| Phase | Scope |
|-------|-------|
| **0–1** ✅ | admin service, session check, companies + tasks CRUD proxy, `/admin` UI shell |
| **2** ✅ | templates: UpsertInterviewTemplate, UpsertTemplateSection, ReplaceTemplateStructure |
| **3** ✅ | billing: plans catalog, user grant/revoke, usage view |
| **4** ✅ | ai: LLM ConfigSource in ai DB, eval jobs list, admin UI |
| **5** ✅ | dashboard: service health, catalog/eval counts, failed job alerts, LLM config snapshot |
| **6** ✅ | knowledge base: articles CRUD (+ videos), edit/preview UI, Today `read_article` brief items |
| **6** ✅ | platform metrics: users/growth, DB size, memory, HTTP RPS per service |

## Dashboard (`GET /v1/admin/dashboard`)

Operator home snapshot for quick triage:

- **Users** — total, signups (24h/7d/30d), active users (7d, by `updated_at`), active subscriptions
- **Runtime** — per-service PostgreSQL size, process memory, goroutines, HTTP RPS (5s smoothed)
- **Totals** — sum of HTTP RPS and DB bytes across identity/content/billing/ai
- **Service health** — identity / content / billing / ai gRPC reachability
- **Catalog counts** — sampled (cap 500) companies, tasks, templates + plan count
- **Evaluation jobs** — pending / running / failed / completed in recent sample
- **Recent failed jobs** — top 10 by `updated_at` with error text
- **LLM config** — current chain order + version

Active users = profile activity in last 7 days (not DAU from sessions). HTTP RPS is measured on each service HTTP gateway, not gRPC.

**LLM chain probe** (`POST /v1/admin/ai/llm/probe`) — live ping of each provider in chain order via minimal chat (summarize model).

## Grafana Cloud

See [deploy/grafana/README.md](../../deploy/grafana/README.md) — Alloy remote_write, dashboard JSON imports, local Prometheus fallback.

## Env (admin service)

```bash
JWT_PUBLIC_KEY_FILE=../identity/scripts/dev/jwt/public.pem
ADMIN_USER_IDS=<uuid1>,<uuid2>
CONTENT_ADMIN_TOKEN=dev-admin-token   # content ADMIN_API_TOKEN
CONTENT_GRPC_ADDR=127.0.0.1:9091
IDENTITY_GRPC_ADDR=127.0.0.1:9090
BILLING_GRPC_ADDR=127.0.0.1:9095
AI_GRPC_ADDR=127.0.0.1:9093
INTERNAL_API_TOKEN=dev-internal-token
```

Content service must expose the same `ADMIN_API_TOKEN` for gRPC admin writes.
