# project-druzya

Monorepo of **independent microservices**. Each service is a self-contained cell — open only its folder and work without the rest of the repo.

## Services

| Service | Path | HTTP | gRPC |
|---------|------|------|------|
| identity | [services/identity/](services/identity/) | :8080 | :9090 |
| content | [services/content/](services/content/) | :8081 | :9091 |
| interview | [services/interview/](services/interview/) | :8082 | :9092 |
| ai | [services/ai/](services/ai/) | :8083 | :9093 |
| sandbox | [services/sandbox/](services/sandbox/) | :8084 | :9094 |
| billing | [services/billing/](services/billing/) | :8085 | :9095 |

## Quick start (inside a service)

```bash
cd services/identity
make help
make start
```

Each service has its own `Makefile`, `AGENTS.md`, `.golangci.yml`, `scripts/dev/docker-compose.yml`, and `.cursor/rules/`.

Root `go.work` is optional — only for working across services in one IDE window. Every service uses `GOWORK=off` in its Makefile and builds standalone.
