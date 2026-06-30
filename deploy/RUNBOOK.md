# Runbook — druz9 production

## Restart order

1. `postgres`, `redis`
2. `migrate` (after schema change only)
3. `identity` → `billing` → `sandbox` → `rooms` → `tracker` → `notes` → `focus`
4. `identity-bot`, `caddy`

```bash
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env restart identity billing sandbox rooms tracker notes focus caddy
```

## Health

Public: `https://api.druz9.online/healthz`

Per-service: `/healthz`, `/readyz` on each container HTTP port.

### Tracker (first deploy on existing Postgres)

`init-databases.sql` runs only on a fresh volume. On an existing server:

```bash
cd deploy
# Add to .env: TRACKER_POSTGRES_DSN=postgres://druzya:...@postgres:5432/druzya_tracker?sslmode=disable
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c 'CREATE DATABASE druzya_tracker;'
docker compose -f docker-compose.prod.yml --env-file .env build migrate tracker caddy
docker compose -f docker-compose.prod.yml --env-file .env run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env up -d tracker notes focus caddy
```

## Logs

```bash
cd deploy
docker compose -f docker-compose.prod.yml logs -f identity tracker
```

## Common fixes

**sandbox timeout / go.mod not found** — `SANDBOX_DEFAULT_TIMEOUT_MS=10000`, host dir `/var/lib/sandbox-work` bind-mounted, `RUNNER_MODE=docker`.

**JWT errors** — `make keys`, `chmod 644 deploy/secrets/jwt/*.pem`, same `public.pem` on all services.

**migrations failed**

Empty prod (no users):

```bash
cd deploy
docker compose -f docker-compose.prod.yml stop identity billing sandbox rooms tracker notes focus identity-bot caddy
make reset-db
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

Prod **with user data:** do not `reset-db` — see [docs/MIGRATION_CUTOVER.md](./docs/MIGRATION_CUTOVER.md).

Normal schema change: `docker compose … run --rm migrate` only.

## Backups

```bash
cd deploy && set -a && source .env && set +a && ./scripts/backup-postgres.sh
```

## Monitoring

Self-hosted: [grafana/README.md](grafana/README.md). **Default:** `make up` and `make deploy` start Prometheus + Grafana (`--profile monitoring`).

```bash
docker compose -f docker-compose.prod.yml --profile monitoring up -d prometheus grafana
```

Grafana: https://grafana.druz9.online — configure alert notification channels for rules in `prometheus-alerts.yml`.

Key metrics: `up`, `http_requests_total`, `http_request_duration_seconds`. AI LLM metrics apply to CI-only `ai` service only.

## LLM (optional — ai service, CI only)

The `ai` evaluation service is **not deployed in prod**. LLM env vars in `.env.example` are for local/CI runs of `services/ai` only.

## Rooms scale

Single replica by default. Multiple pods need sticky `/ws/*` — see [services/rooms/AGENTS.md](../services/rooms/AGENTS.md).

## Secret rotation

**INTERNAL_API_TOKEN** — update `.env`, restart services that use `x-internal-token` (tracker, billing adapters, etc.).

**JWT keys** — maintenance window; redeploy all JWT consumers.

## Deploy from CI

GitHub Actions (`deploy.yml`) runs on merge to `main`. Server repo: `/opt/project-druzya`.

If git fails with "dubious ownership" after manual rsync: `git config --global --add safe.directory /opt/project-druzya && chown -R $(whoami):$(id -gn) /opt/project-druzya`.
