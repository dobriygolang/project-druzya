# AGENTS.md — billing service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/billing`

## Layout

```
cmd/billing/app/
api/billing/v1/
internal/billing/
internal/adapter/postgres/
internal/app/api/billing/
internal/services/worker/
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Commands

```bash
make start         # :8085 / :9095
make run-worker
make lint
make gen-proto
```

See `make help`.
