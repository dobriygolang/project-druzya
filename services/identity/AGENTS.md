# AGENTS.md — identity service

**Self-contained service.** Work from this directory only — no root Makefile or monorepo context required.

Monorepo service template: [../../AGENTS.md](../../AGENTS.md#service-template-canonical). This file = identity-specific domain docs.

Module: `github.com/sedorofeevd/project-druzya/services/identity`

## Purpose

Identity handles **authentication and user profiles** for frontend and internal services.

- Registration = login (upsert on OAuth / Telegram code)
- Providers: **Telegram bot code**, **Yandex OAuth**
- Tokens: **RS256 JWT** access + Redis refresh
- Transport: **gRPC + HTTP** (grpc-gateway, same proto contract)

## Layout

```
cmd/identity/                 API entrypoint (HTTP gateway + gRPC)
cmd/identity-bot/             Telegram bot (issues login codes)
api/identity/v1/              proto source (+ api/google/api annotations)
pkg/api/                      generated (make gen-proto) — gitignored
pkg/jwt/                      public key validator for other services
internal/
  user/
    model/                    User entity
    repository/               PostgreSQL user storage
  auth/
    model/                    TelegramLoginCode, OAuthState
    repository/               Redis session storage
    service/                  auth business logic, JWT
    logincode/                code generator for bot
  adapter/yandex/             Yandex OAuth client
  app/api/identity/           gRPC/HTTP transport
  bot/                        Telegram bot
  config/
scripts/migrations/           goose SQL
scripts/dev/                  docker-compose, gen-jwt-keys.sh, jwt/
```

## Domain model

### User (`users` table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | generated |
| `username` | TEXT UNIQUE NOT NULL | lowercase slug; collision → `_suffix` |
| `telegram_id` | BIGINT UNIQUE nullable | set after TG login |
| `yandex_id` | TEXT UNIQUE nullable | set after Yandex login/link |
| `avatar_url` | TEXT | TG avatar priority over Yandex on merge |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Constraint: at least one of `telegram_id`, `yandex_id` must be set.

### Redis keys

| Key | TTL | Purpose |
|-----|-----|---------|
| `login_code:{code}` | 5m | Telegram one-time login payload |
| `refresh:{sha256}` | 720h default | refresh token → user_id |
| `oauth_state:{state}` | 10m | Yandex login/link flow state |
| `exchange_code:{code}` | 5m | post-Yandex redirect exchange → user_id |

## Auth flows

### Telegram (bot code)

1. Frontend shows link `https://t.me/<bot>?start=login`
2. User sends `/start login` to bot
3. Bot writes `login_code:{CODE}` to Redis, replies with CODE (8 chars)
4. Frontend `POST /v1/auth/telegram` `{ "code": "..." }`
5. Identity upserts user by `telegram_id`, returns tokens

Run bot: `make run-bot` (needs `TELEGRAM_BOT_TOKEN`, `REDIS_ADDR`).

### Yandex OAuth

1. `GET /v1/auth/yandex/url` → `{ url, state }`
2. User authorizes on Yandex
3. Browser hits `GET /v1/auth/yandex/callback?code&state` (HTTP redirect handler)
4. Identity upserts/links user, stores `exchange_code`, redirects to `{FRONTEND_URL}/auth/callback?code=...`
5. Frontend `POST /v1/auth/yandex/exchange` `{ "exchange_code": "..." }` → tokens

**Link Yandex** to existing account: call `GET /v1/auth/yandex/url` with `Authorization: Bearer <access_token>`, then same callback flow attaches `yandex_id` to current user.

### Tokens

| Token | Storage | TTL default |
|-------|---------|-------------|
| Access JWT RS256 | stateless | 15m |
| Refresh | Redis hash | 720h |

JWT claims: `sub` = user UUID, `kid` = `v1`.

Other services verify access tokens with `pkg/jwt` or fetch public key from `GET /v1/jwt/public.pem`.

## API

### Public HTTP (grpc-gateway)

| Method | Path | Auth |
|--------|------|------|
| POST | `/v1/auth/telegram` | no |
| GET | `/v1/auth/yandex/url` | optional Bearer (link mode) |
| GET | `/v1/auth/yandex/callback` | no (browser redirect) |
| POST | `/v1/auth/yandex/exchange` | no |
| POST | `/v1/auth/refresh` | no |
| POST | `/v1/auth/logout` | Bearer |
| GET | `/v1/me` | Bearer |
| POST | `/v1/me/link/yandex` | Bearer |

Extra HTTP routes (not in gateway): `/healthz`, `/v1/jwt/public.pem`.

### Internal gRPC (no HTTP mapping)

| RPC | Purpose |
|-----|---------|
| `GetUser` | fetch user by id (service-to-service) |
| `ValidateToken` | optional token check via identity |

## Commands

```bash
make help
make gen-jwt-keys   # dev RS256 keys → scripts/dev/jwt/
make start          # docker deps + migrate + run API
make run            # API only (auto-loads dev JWT keys)
make run-bot        # Telegram bot
make build
make lint
make test
make gen-proto
make migrate-new NAME=...
make stop
```

| Endpoint | Default |
|----------|---------|
| HTTP | `http://localhost:8080` |
| gRPC | `localhost:9090` |

## Environment

| Variable | Required | Default |
|----------|----------|---------|
| `HTTP_PORT` | no | `8080` |
| `GRPC_PORT` | no | `9090` |
| `POSTGRES_DSN` | no | local docker DSN |
| `REDIS_ADDR` | no | `localhost:6379` |
| `JWT_PRIVATE_KEY` / `JWT_PRIVATE_KEY_FILE` | yes | `make gen-jwt-keys` for dev |
| `JWT_PUBLIC_KEY` / `JWT_PUBLIC_KEY_FILE` | yes | same |
| `JWT_ACCESS_TTL` | no | `15m` |
| `JWT_REFRESH_TTL` | no | `720h` |
| `TELEGRAM_BOT_TOKEN` | bot only | |
| `TELEGRAM_BOT_USERNAME` | no | for frontend deep link |
| `YANDEX_CLIENT_ID` | yandex | |
| `YANDEX_CLIENT_SECRET` | yandex | |
| `YANDEX_REDIRECT_URI` | yandex | must match Yandex app |
| `FRONTEND_URL` | no | `http://localhost:3000` |
| `LOG_LEVEL` | no | `info` |

## Proto / codegen

- Edit `api/identity/v1/identity.proto`
- Google API annotations vendored in `api/google/api/`
- `make gen-proto` → `pkg/api/` (gitignored; run before build in CI)
- Plugins: `protoc-gen-go`, `protoc-gen-go-grpc`, `protoc-gen-grpc-gateway` (built into `.bin/`)

## Consumer services

Import `github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt`:

```go
validator, err := jwt.NewValidator(publicKeyPEM)
userID, err := validator.UserID(accessToken)
```

Copy public key from identity env or `GET /v1/jwt/public.pem`.

## Checklist

| Step | Action |
|------|--------|
| Verify | `make gen-proto` → `make lint` → `make test` |
| Proto | edit `api/` → `make gen-proto` — never edit `pkg/api/` |
| Migrations | `make migrate-new NAME=...` → edit SQL in `scripts/migrations/` |
| No commits | user commits manually |

## Go proxy

`goproxy.s.o3.ru: Forbidden` or `checksum mismatch` on `go.sum` — corporate proxy stale cache. Fix:

```bash
GOPROXY=https://proxy.golang.org,direct go mod tidy
```

Proto tools (`buf`, `protoc-gen-*`) install via `make gen-proto` into `.bin/` with pinned versions — **not** in `go.mod`.

## Policy

- English code/logs; errors lowercase with `%w`
- Minimal diffs; no AI mentions in commits
