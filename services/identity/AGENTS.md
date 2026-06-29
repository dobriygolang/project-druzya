# AGENTS.md — identity service

Work from this directory only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/identity`

## Purpose

Auth and user profiles: **Telegram bot code**, **Yandex OAuth**, **RS256 JWT** + Redis refresh.

## Ports

HTTP `8080` | gRPC `9090` | Postgres `5432` / `druzya` | Redis `6379`

## Data

**users** — `id`, `username`, `telegram_id`, `yandex_id`, `avatar_url`, `timezone` (IANA, optional). At least one provider id required.

**Redis:** `login_code:{code}` (5m), `refresh:{hash}` (720h), `oauth_state:{state}` (10m), `exchange_code:{code}` (5m).

## Auth flows

**Telegram:** bot issues code → `POST /v1/auth/telegram` → upsert by `telegram_id`.

**Yandex:** `GET /v1/auth/yandex/url` → callback → redirect with exchange code → `POST /v1/auth/yandex/exchange`.

**Link Yandex:** same URL flow with `Authorization: Bearer` on `/yandex/url`.

Other services verify JWT via `pkg/jwt` or `GET /v1/jwt/public.pem`.

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/v1/auth/telegram`, `/refresh`, `/logout` | no / no / Bearer |
| GET | `/v1/auth/yandex/url`, `/yandex/callback` | optional Bearer / no |
| POST | `/v1/auth/yandex/exchange` | no |
| GET | `/v1/me` | Bearer |
| PATCH | `/v1/me` | Bearer — optional `timezone` (IANA) |

Internal gRPC: `GetUser`, `ValidateToken`, `MintScopedAccessToken` (rooms guests).

Extra HTTP: `/healthz`, `/v1/jwt/public.pem`.

## Commands

```bash
make gen-jwt-keys   # dev keys → scripts/dev/jwt/
make start          # deps + migrate + API
make run-bot        # Telegram bot
make gen-proto | lint | test | build
```

## Env (main)

| Variable | Default |
|----------|---------|
| JWT_* | required (`make gen-jwt-keys` for dev) |
| JWT_ACCESS_TTL / JWT_REFRESH_TTL | `15m` / `720h` |
| TELEGRAM_BOT_TOKEN | bot only |
| YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET, YANDEX_REDIRECT_URI | OAuth |
| FRONTEND_URL | `http://localhost:3000` |
