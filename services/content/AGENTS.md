# AGENTS.md — content service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/content`

## Layout

```
cmd/content/app/           DI + HTTP/gRPC server
api/content/v1/            proto
pkg/api/                   generated
internal/content/          domain
internal/adapter/postgres/
internal/app/api/content/  gRPC transport
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Commands

```bash
make start    # deps + migrate + API (:8081 / :9091)
make run
make lint
make gen-proto
make migrate-new NAME=...
```

See `make help` for all targets.
