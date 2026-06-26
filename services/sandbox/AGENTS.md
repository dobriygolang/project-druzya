# AGENTS.md — sandbox service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/sandbox`

## Layout

```
cmd/sandbox/app/
api/sandbox/v1/
internal/sandbox/
internal/adapter/queue/
internal/app/api/sandbox/
internal/services/worker/
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Commands

```bash
make start         # :8084 / :9094
make run-worker
make lint
make gen-proto
```

See `make help`.
