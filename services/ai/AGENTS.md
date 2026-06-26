# AGENTS.md — ai service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/ai`

## Layout

```
cmd/ai/app/
api/ai/v1/
internal/ai/                 domain
internal/app/api/ai/
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Commands

```bash
make start    # :8083 / :9093
make run
make lint
make gen-proto
```

See `make help`.
