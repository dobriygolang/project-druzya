# Deploy — druz9 production

See **[PROD_PLAN.md](./PROD_PLAN.md)** and **[RUNBOOK.md](./RUNBOOK.md)**.

```bash
# Monitoring (optional)
make monitoring   # Prometheus :9099, Grafana :3000

# Backup
make backup
```

## Quick reference

```bash
# 1. DNS: point api/app/apex domains to server IP (see PROD_PLAN.md)

# 2. Copy and fill secrets (same POSTGRES_PASSWORD in every DSN)
cp deploy/.env.example deploy/.env

# 3. Start stack (builds images, generates JWT keys, runs migrations + seed)
cd deploy
make up

# 4. Smoke test
curl -s https://api.druz9.ru/v1/companies
curl -s https://app.druz9.ru/
```

## DNS checklist

Point to server IP:

- `api.druz9.ru`, `api.druz9.online`
- `app.druz9.ru`, `app.druz9.online`
- `druz9.ru`, `druz9.online` (apex → redirect to app)

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Plan + `.env.example` | done |
| 1 | Seed, Docker, Caddy, hardening | code done — deploy on server pending |
| 2 | readyz, metrics, CORS, backups, CI | **code done** |
| 3 | sandbox, billing, admin, cleanup | pending |
