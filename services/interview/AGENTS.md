# AGENTS.md — interview service

**Self-contained service.** Work from this directory only.

Module: `github.com/sedorofeevd/project-druzya/services/interview`

## Layout

```
cmd/interview/app/           DI + server + worker entry
api/interview/v1/
internal/interview/          domain
internal/adapter/postgres/ + queue/
internal/app/api/interview/
internal/services/worker/    queue consumers
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Commands

```bash
make start         # API (:8082 / :9092)
make run-worker    # background consumer
make lint
make gen-proto
```

See `make help`.
