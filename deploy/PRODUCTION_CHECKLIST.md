# Production checklist — druz9

Before first deploy: fill secrets, then `cd deploy && make up`.

## 1. Server

| Item | Notes |
|------|-------|
| Ubuntu 22.04+ / Debian 12+ | Docker Compose v2 |
| Ports 80, 443, 22 | nginx TLS on host; Caddy on `127.0.0.1:18080` |
| DNS A-records | `druz9.online`, `api.druz9.online`, `app.druz9.online`, `grafana.druz9.online` |

## 2. `deploy/.env`

`cp deploy/.env.example deploy/.env`

| Variable | How |
|----------|-----|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `INTERNAL_API_TOKEN` | `openssl rand -hex 32` |
| `ADMIN_API_TOKEN` | `openssl rand -hex 32` |
| `ADMIN_USER_IDS` | identity user UUIDs |
| `ROOM_INVITE_SECRET` | `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | BotFather |
| `YANDEX_*` | OAuth app |
| `GROQ_API_KEY` (or other LLM) | at least one provider |
| `CADDY_EMAIL` | Let's Encrypt |

JWT: `cd deploy && make keys` → `secrets/jwt/*.pem` (do not commit).

Optional: Tribute webhooks, paid LLM keys, Grafana password — see [RUNBOOK.md](./RUNBOOK.md).

## 3. OAuth redirects

Yandex app: `https://api.druz9.ru/v1/auth/yandex/callback` (+ `.online` mirror).

## 4. GitHub Actions deploy

Secrets: `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, optional `DEPLOY_GIT_TOKEN`.

First time on VPS (manual or scripted):

```bash
# Option A — bootstrap script (Docker + clone + .env + JWT keys):
./deploy/scripts/bootstrap-server.sh git@github.com:YOUR_ORG/project-druzya.git

# Option B — manual:
git clone git@github.com:YOUR_ORG/project-druzya.git /opt/project-druzya
cd /opt/project-druzya/deploy
cp .env.example .env && nano .env && make keys && make up
```

Updates: merge to `main` → CI deploys automatically.

## 5. Smoke test

- [ ] `https://api.druz9.ru/healthz`
- [ ] Yandex login
- [ ] Mock interview start
- [ ] Live room WS
- [ ] `docker compose ps` — healthy

Ops: [RUNBOOK.md](./RUNBOOK.md)
