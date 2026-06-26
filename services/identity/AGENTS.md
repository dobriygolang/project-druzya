# AGENTS.md — identity service

**Self-contained service.** Work from this directory only — no root Makefile or monorepo context required.

Module: `github.com/sedorofeevd/project-druzya/services/identity`

## Layout

```
cmd/identity/              entrypoint + app/run.go (DI) + app/server.go
api/identity/v1/           proto source
pkg/api/                   generated (make gen-proto)
internal/
  app/api/identity/        gRPC transport
  identity/                domain: model/, repository/, service/
  adapter/postgres/        user repository + pool
  config/                  env config
  tools/logger/
scripts/migrations/        goose SQL
scripts/dev/               docker-compose (postgres + redis)
```

## Commands (all from this folder)

```bash
make help
make start          # docker deps + migrate + run API
make run            # API only (needs deps)
make build          # .bin/identity
make lint           # golangci-lint + buf + mod drift
make test
make gen-proto
make migrate-new NAME=init_users
make stop           # docker down
```

| Endpoint | Default |
|----------|---------|
| HTTP | `http://localhost:8080/healthz` |
| gRPC | `localhost:9090` |

Env: `HTTP_PORT`, `GRPC_PORT`, `POSTGRES_DSN`, `REDIS_ADDR`, `LOG_LEVEL`.

## Checklist

| Step | Action |
|------|--------|
| Verify | `make lint` → `make test` |
| Proto | edit `api/` → `make gen-proto` — never edit `pkg/api/` |
| Migrations | `make migrate-new NAME=...` → edit SQL in `scripts/migrations/` |
| No commits | user commits manually |

## Go proxy

`goproxy.s.o3.ru: Forbidden` is env/proxy, not code. Use VPN or `GOPROXY=https://proxy.golang.org,direct`.

## Policy

- English code/logs; errors lowercase with `%w`
- Minimal diffs; no AI mentions in commits
