# Runbook — druz9 production

## Restart order

1. `postgres`, `redis`
2. `migrate` (one-shot, only after schema change)
3. `identity` → `content` → `interview` → `billing` → `sandbox` → `rooms`
4. `ai`, `recommendation` (parallel)
5. `identity-bot`, `caddy`

```bash
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env restart identity content interview billing sandbox rooms ai recommendation caddy
```

## Health endpoints

| Service | Liveness | Readiness |
|---------|----------|-----------|
| identity | `/healthz` | `/readyz` (PG + Redis) |
| content | `/healthz` | `/readyz` (PG) |
| interview | `/healthz` | `/readyz` (PG + content gRPC) |
| ai | `/healthz` | `/readyz` (PG + interview + content) |
| recommendation | `/healthz` | `/readyz` (PG + interview + content) |
| billing | `/healthz` | `/readyz` (PG) |
| sandbox | `/healthz` | `/readyz` (PG) |
| rooms | `/healthz` | `/readyz` (PG + identity gRPC) |

Public API health: `https://api.druz9.ru/healthz`

## Logs

```bash
cd deploy
docker compose -f docker-compose.prod.yml logs -f identity
docker compose -f docker-compose.prod.yml logs -f ai
docker compose -f docker-compose.prod.yml logs -f interview
```

## Common failures

### ai fails to start in production

- **Cause:** no LLM API keys or `INTERNAL_API_TOKEN=dev-internal-token`
- **Fix:** set `GROQ_API_KEY` (or other provider) and generate a strong `INTERNAL_API_TOKEN` in `.env`

### interview `/readyz` fails

- **Cause:** content not ready or wrong `CONTENT_GRPC_ADDR`
- **Fix:** `docker compose ps`, check content logs, verify `content:9091` in compose network

### sandbox Go run timeout

- **Cause:** first `go run` in Docker can take ~5s (compile); default timeout was 2s.
- **Fix:** `SANDBOX_DEFAULT_TIMEOUT_MS=10000`, persistent GOCACHE at `/var/lib/sandbox-work/gocache`, rebuild sandbox (warm-up on start).

### RAM tuning (30 GB single-node)

- **Postgres:** `shared_buffers=6GB`, `effective_cache_size=20GB` (see `docker-compose.prod.yml`).
- **Redis:** `maxmemory 512mb`, policy `allkeys-lru` — identity sessions + billing entitlements cache.
- **Content:** in-process catalog snapshot; watch `content_catalog_*` metrics on `/metrics`.
- **Billing:** in-process plans snapshot + optional Redis entitlements (`ENTITLEMENTS_CACHE_TTL`).
- **AI:** exact prompt hash cache (`LLM_PROMPT_CACHE=on`); watch `llm_prompt_cache_saved_tokens_total` on `/metrics`.

### sandbox Go compile_error: go.mod file not found

- **Cause:** sandbox runs code via host Docker (`/var/run/docker.sock`). Work dirs must live on a **host path** bind-mounted into the sandbox container at the same path (`/var/lib/sandbox-work`).
- **Fix:** on the host once: `mkdir -p /var/lib/sandbox-work && chmod 700 /var/lib/sandbox-work`, rebuild/restart sandbox after deploy.

### migrations failed

Full schema reset (empty prod, no users — forward-only init migrations):

```bash
cd deploy
# stop app services so nothing holds DB connections
docker compose -f docker-compose.prod.yml stop identity content interview ai recommendation billing sandbox rooms identity-bot caddy
make reset-db
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

Single migration run after a normal schema change:

```bash
cd deploy
docker compose -f docker-compose.prod.yml run --rm migrate
```

### JWT / auth errors

- Ensure `deploy/secrets/jwt/` exists (`make keys`)
- Keys must be readable by container user `nobody`: `chmod 644 deploy/secrets/jwt/*.pem`
- All services using JWT must mount the same `public.pem`

### Caddy TLS issues

- DNS must point to server before first start
- Check `docker compose logs caddy`
- Certificates stored in volume `caddy_data`

## Backups

```bash
cd deploy
set -a && source .env && set +a
./scripts/backup-postgres.sh
```

Requires `pg_dump` on host, or run from a postgres client container.

## Monitoring (optional)

**Self-hosted Grafana (recommended):** see [grafana/README.md](grafana/README.md).

```bash
cd deploy
# set GRAFANA_ADMIN_PASSWORD in .env, then:
docker compose -f docker-compose.prod.yml --profile monitoring up -d prometheus grafana
```

SSH tunnel: `ssh -L 9099:127.0.0.1:9099 root@server` → Prometheus at http://localhost:9099

**Grafana:** https://grafana.druz9.online (`admin` / `$GRAFANA_ADMIN_PASSWORD`).

DNS: add **A** `grafana.druz9.online` → server IP at your registrar (reg.ru). Then expand TLS:

```bash
certbot certonly --webroot -w /var/www/html --cert-name druz9.online --expand \
  -d druz9.online -d app.druz9.online -d api.druz9.online -d grafana.druz9.online \
  -d druz9.ru -d app.druz9.ru -d api.druz9.ru
sudo nginx -t && sudo systemctl reload nginx
```

**Grafana Cloud (optional):**

Useful eval-flow metrics:

- `outbox_lag_seconds{service="ai|recommendation"}` — queue wait before handler
- `outbox_handler_duration_seconds` — handler latency
- `llm_calls_total{provider,result}` — LLM provider health
- Filter logs by `attempt_id` across ai → interview internal RPCs (`x-attempt-id` metadata)

Operator snapshot metrics (users, DB size, LLM chain ping) live in **admin UI** `/admin`, not Prometheus.

## Paid LLM (production scale)

Eval routes by **billing plan**: free users → free chain keys; `pro_monthly` → paid chain keys.
Two separate key sets — you never pay for free-user traffic on DeepSeek/Groq paid.

### Free plan limits (billing `00001_init.sql`)

| Entitlement | Free | Pro |
|-------------|------|-----|
| AI eval / day | **25** | 100 |
| Mock interviews / month | **3** | 30 |

25 eval/day × ~2 LLM calls ≈ 50 API calls/user — tuned for mock prep days while staying within Groq free org quota.

### Env: split chains

```bash
# Free chain (free-tier API keys only)
LLM_FREE_CHAIN_ORDER=groq,cloudflare,openrouter
GROQ_API_KEY=gsk_...              # Groq free tier
OPENROUTER_API_KEY=sk-or-...
CLOUDFLARE_API_KEY=...
CLOUDFLARE_ACCOUNT_ID=...

# Paid chain (separate keys — do not reuse free keys)
LLM_PAID_CHAIN_ORDER=deepseek,groq
DEEPSEEK_API_KEY=sk-...
GROQ_PAID_API_KEY=gsk_...         # Groq Developer / paid project
OPENROUTER_PAID_API_KEY=sk-or-... # optional

EVAL_WORKER_CONCURRENCY=20        # tune for paid RPM
```

Legacy `LLM_CHAIN_ORDER` is fallback when `LLM_FREE_CHAIN_ORDER` is empty.

Admin LLM probes show `free/groq`, `pro/deepseek`, etc.

### Provider economics (pro chain)

| Provider | Role | Cost (eval ~5k tokens) | Notes |
|----------|------|--------------------------|-------|
| **DeepSeek** | Primary judge | **~$0.002–0.004** | [platform.deepseek.com](https://platform.deepseek.com) — UnionPay/crypto, no geo block from RU VPS |
| **Groq Developer** | Fast primary / fallback | **~$0.002** | Same `GROQ_API_KEY`, upgrade tier in console — **500+ RPM** vs 30 RPM free |
| **OpenRouter** | Optional tail | +5–15% markup | One key, many models; good backup |
| OpenAI direct | Avoid for eval | $0.01+ | Expensive; geo/billing friction |

**Cheapest stack:** `deepseek` only (~$2–4 / 1000 evals).  
**Fastest stack:** `groq` paid first (~$2–3 / 1000 evals, lowest latency).  
**Balanced:** `LLM_CHAIN_ORDER=deepseek,groq,openrouter`

### `.env` checklist (paid keys on prod)

Apply billing init migration (or `make reset-db` + migrate on empty prod), then set keys above and restart `ai` + `billing`.

Watch Grafana **AI & LLM** dashboard: `llm_calls_total`, `outbox_lag_seconds`.

### Billing alignment

Product billing limits eval **count** per user; pro chain keys limit **spend**.
Monitor provider dashboards + `model_calls` table for cost drift.

## Rooms horizontal scale

Live collab WebSocket state is in-memory per `rooms` pod. **Do not run multiple `rooms` replicas without sticky sessions on `/ws/*`.**

If scaling out:

1. Keep a single `rooms` instance (simplest), **or**
2. Put nginx/HAProxy in front with source-ip sticky routing to `/ws/*`, **or**
3. Plan shared Yjs backend (not implemented — see `services/rooms/AGENTS.md`).

## Secret rotation

### INTERNAL_API_TOKEN

1. Generate new token
2. Update `.env` for `ai`, `interview`, `recommendation`
3. Restart those three services together

### JWT keys

Rotation requires signing new keys and redeploying all services that validate JWT. Plan a maintenance window.

## Internal token doc

`INTERNAL_API_TOKEN` is shared by ai ↔ interview ↔ recommendation for gRPC internal RPCs (`x-internal-token` header). Never expose publicly; rotate periodically.
