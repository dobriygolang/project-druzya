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

```bash
cd deploy
docker compose -f docker-compose.prod.yml --profile monitoring up -d
```

- Prometheus: http://server:9099
- Grafana: http://server:3000 (default admin / see `GRAFANA_ADMIN_PASSWORD`)

Useful eval-flow metrics (when monitoring profile enabled):

- `outbox_lag_seconds{service="ai|recommendation"}` — queue wait before handler
- `outbox_handler_duration_seconds` — handler latency
- Filter logs by `attempt_id` across ai → interview internal RPCs (`x-attempt-id` metadata)

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
