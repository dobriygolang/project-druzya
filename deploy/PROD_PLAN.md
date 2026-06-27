# Production plan — druz9.ru / druz9.online

> **Source of truth** for prod deployment. Update task status here after each PR/session.
> Last updated: 2026-06-27

## Current backend state (snapshot)

| Service | On disk | Prod-ready logic | Deploy artifacts |
|---------|---------|------------------|------------------|
| identity | yes | yes | no |
| content | yes | yes (read-only) | no |
| interview | yes | yes | no |
| ai | yes | yes | no |
| recommendation | yes | yes | no |
| template | yes | skeleton only | no |
| sandbox | **no** (P2 recreate) | stub in index | no |
| billing | **no** (P2 recreate) | stub in index | no |

**Core user loop works:** auth → catalog → session → submit → LLM eval → recommendations.

**Blockers before go-live:** no seed data, no containers, no reverse proxy, gRPC binds localhost, no `/readyz`, no metrics, fake LLM if keys missing.

---

## Domains

| Host | Role | Notes |
|------|------|-------|
| **api.druz9.ru** | Primary public API | Caddy TLS, routes to services |
| **api.druz9.online** | Mirror API | Same Caddy site block, same upstreams |
| **app.druz9.ru** | Frontend (later) | User provides UI; placeholder static until then |
| **app.druz9.online** | Frontend mirror | Same app or redirect to `.ru` |
| **druz9.ru** | Apex | 301 → `https://app.druz9.ru` |
| **druz9.online** | Apex | 301 → `https://app.druz9.online` (or same app) |

### API routing (Caddy path prefix)

| Path prefix | Service | Internal port |
|-------------|---------|---------------|
| `/v1/auth/*`, `/v1/users/*`, `/v1/jwt/*` | identity | 8080 |
| `/v1/companies*`, `/v1/interview-templates*`, `/v1/tasks*`, `/v1/rubrics*` | content | 8081 |
| `/v1/interview/*` | interview | 8082 |
| `/v1/recommendations/*` | recommendation | 8084 |
| `/v1/sandbox/*` | sandbox | 8086 |
| `/v1/rooms/*`, `/ws/editor/*` | rooms | 8087 |
| `/v1/billing/*` | billing | 8085 |

gRPC (9090–9094): Docker internal network only, not via Caddy.

### OAuth / auth URLs (fill after DNS)

```
FRONTEND_URL=https://app.druz9.ru
YANDEX_REDIRECT_URI=https://api.druz9.ru/v1/auth/yandex/callback
```

Register **both** `api.druz9.ru` and `api.druz9.online` redirect URIs in Yandex OAuth if both API mirrors are used.

---

## Architecture (single server MVP)

```
Internet
   │
   ▼
 Caddy (:443)  api.druz9.{ru,online}
   ├── identity:8080
   ├── content:8081
   ├── interview:8082
   └── recommendation:8084

 docker network `druzya`
   ├── postgres (1 instance, 5 databases)
   ├── redis
   ├── identity + identity-bot
   ├── content, interview, ai, recommendation
   └── (P2) sandbox, billing

 ai:9093 ──gRPC──► interview:9092, content:9091
 recommendation:9094 ──gRPC──► interview, content
 interview:9092 ──gRPC──► content:9091
```

**Boot order:** postgres/redis → identity → content → interview → ai + recommendation (parallel) → identity-bot → caddy.

---

## Port matrix (prod)

| Service | HTTP | gRPC | DB |
|---------|------|------|-----|
| identity | 8080 | 9090 | druzya |
| content | 8081 | 9091 | druzya_content |
| interview | 8082 | 9092 | druzya_interview |
| ai | 8083 | 9093 | druzya_ai |
| recommendation | 8084 | 9094 | druzya_recommendation |
| sandbox (P2) | 8086 | 9096 | druzya_sandbox |
| billing (P2) | 8085 | 9095 | druzya_billing |

---

## Phases

### Phase 0 — Tracking & config (this session)

- [x] `deploy/PROD_PLAN.md` (this file)
- [x] `deploy/.env.example` — user fills secrets
- [ ] User: DNS A/AAAA → server IP for `api.druz9.ru`, `api.druz9.online`, apex domains
- [ ] User: copy `.env.example` → `.env`, fill keys
- [ ] User: server SSH access when Phase 1 ready

### Phase 1 — P0 (go-live minimum)

#### 1.1 Content seed
- [x] `services/content/scripts/migrations/00002_seed_catalog.sql`
  - 1 company (yandex)
  - 1 interview template + 2 sections
  - 7 published tasks (5 algorithm + 2 behavioral)
  - task_solutions + rubrics per task_type
  - Fixed UUIDs for idempotent re-run

#### 1.2 Code hardening (before containers)
- [x] `GRPC_HOST` env (default `0.0.0.0` in prod, `127.0.0.1` in dev) — all 5 services `server.go`
- [x] gRPC clients: Docker service names via compose env (`content:9091`, etc.)
- [x] `APP_ENV=production`: ai-service **fail startup** if no LLM API keys
- [x] `APP_ENV=production`: reject `INTERNAL_API_TOKEN=dev-internal-token`

#### 1.3 Containers
- [x] `deploy/Dockerfile` — multi-stage Go build (SERVICE + optional CMD arg)
- [x] `deploy/Dockerfile.migrate` — goose migrate all services
- [x] `deploy/docker-compose.prod.yml` — all services + postgres + redis + caddy
- [x] `deploy/Caddyfile` — dual domain, path routing, auto HTTPS
- [x] `deploy/scripts/init-databases.sql` — create 4 extra DBs on first postgres start
- [x] `deploy/scripts/migrate-all.sh` — goose up for each service
- [x] `deploy/scripts/gen-jwt-keys.sh` — RS256 pair into `deploy/secrets/jwt/`
- [x] `deploy/.dockerignore`
- [x] `deploy/Makefile` — `make up`, `build`, `keys`

#### 1.4 Frontend (SPA)

- [x] `apps/web/` — MVP React SPA (auth, interview, dashboard, sandbox run)
- [x] `deploy/Dockerfile.caddy` — builds `apps/web` into caddy `/srv`
- [ ] Wire `app.druz9.*` after first `docker compose build caddy`

#### 1.5 First deploy (needs server access)
- [ ] Clone repo on server
- [ ] Fill `.env`, run migrations + seed
- [ ] `docker compose up -d`
- [ ] Smoke: `/healthz` on each service, `GET /v1/companies`, auth flow manual

---

### Phase 2 — P1 (stability & ops)

#### 2.1 Health & readiness
- [x] `/readyz` on all 5 services — ping Postgres (+ Redis for identity)
- [x] interview/ai/recommendation readyz: upstream gRPC ping
- [x] compose `depends_on: condition: service_healthy` + `/readyz` healthchecks

#### 2.2 Observability
- [x] Prometheus `/metrics` handler (`internal/tools/ops`)
- [x] Metrics: HTTP latency, outbox events, LLM calls
- [ ] Structured log fields: `service`, `trace_id` (deferred)
- [x] `docker compose --profile monitoring` — Prometheus + Grafana

#### 2.3 Security & network
- [x] CORS middleware — `CORS_ALLOWED_ORIGINS`
- [x] Auth rate limit on identity `/v1/auth*` (production)
- [ ] Postgres `sslmode=prefer` for managed PG (documented in RUNBOOK)
- [x] Internal token rotation doc in RUNBOOK

#### 2.4 Backups & runbooks
- [x] `deploy/scripts/backup-postgres.sh`
- [x] `deploy/RUNBOOK.md`

#### 2.5 CI
- [x] `.github/workflows/ci.yml`
- [ ] `.github/workflows/deploy.yml` — manual SSH deploy (when server access)

---

### Phase 3 — P2 (full product)

#### 3.1 Cleanup
- [x] Remove `cmd/template/` + `internal/app/api/template` from ai + recommendation
- [x] Update root `README.md`
- [x] Delete orphan `backend/go.mod`
- [x] Update root `README.md` + `AGENTS.md` (removed ghost sandbox/billing)

#### 3.2 sandbox service
- [x] `services/sandbox`, ports 8086/9096
- [x] RunCode / GetCodeRun / ListCodeRuns / SubmitAttemptFromCodeRun
- [x] CodeRunner port: fake (default), process (dev), docker stub
- [x] Content metadata tests (sample/submit), hidden output redaction
- [ ] Docker runner with network isolation
- [ ] Wire interview `live_coding` UX end-to-end

#### 3.3 billing service
- [x] Copy template → `services/billing`, ports 8085/9095
- [x] Plans, usage counters, LLM call metering hook from ai `RunEvaluation`
- [x] Gate eval on quota (ai → billing `CheckQuota` / `RecordUsage`)

#### 3.4 Content admin
- [x] Internal CRUD RPCs for companies/tasks (admin token)
- [ ] Or: CLI `content-import` JSON/YAML loader

#### 3.5 Recommendation LLM summaries
- [x] Human-readable profile summary via ai-service internal RPC
- [x] Reuse `caveman` wrapper on prompts (via `LLM_CAVEMAN`)

#### 3.6 Event bus (optional)
- [ ] Replace outbox polling with Redis Streams or NATS — only if scale requires

---

## What user provides

| Item | When |
|------|------|
| DNS records → server IP | Phase 1 deploy |
| `.env` secrets (see `.env.example`, [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)) | Phase 1 |
| SSH access to server | Phase 1 deploy |
| Yandex OAuth app + redirect URIs | Phase 1 |
| Telegram bot token + username | Phase 1 |
| LLM API keys (Groq etc.) | Phase 1 |
| Frontend codebase | **MVP in `apps/web/`** — wire build to `app.druz9.ru` |

---

## Session log

| Date | Done |
|------|------|
| 2026-06-27 | Prod assessment; LLM caveman; recommendation Phase 2; `deploy/PROD_PLAN.md` |
| 2026-06-27 | **Phase 2**: readyz, Prometheus metrics, CORS, rate limit, compose healthchecks, CI, RUNBOOK, backup script |
| 2026-06-27 | **Phase 3**: billing + sandbox services, content admin RPCs, LLM profile summaries, deploy/CI wiring |

---

## Next action

**Phase 1.5 — deploy on server** (unchanged):
1. DNS → server IP
2. `cp deploy/.env.example deploy/.env` + fill secrets (incl. `ADMIN_API_TOKEN`, billing/sandbox DSNs)
3. `cd deploy && make up`
4. Smoke test API
