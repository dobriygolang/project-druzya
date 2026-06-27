# project-druzya

Monorepo of **independent microservices**. Each service is self-contained — open its folder and follow local `AGENTS.md`.

## Services

| Service | Path | HTTP | gRPC | Prod |
|---------|------|------|------|------|
| identity | [services/identity/](services/identity/) | 8080 | 9090 | yes |
| content | [services/content/](services/content/) | 8081 | 9091 | yes |
| interview | [services/interview/](services/interview/) | 8082 | 9092 | yes |
| ai | [services/ai/](services/ai/) | 8083 | 9093 | yes |
| recommendation | [services/recommendation/](services/recommendation/) | 8084 | 9094 | yes |
| template | [services/template/](services/template/) | 8099 | 9199 | skeleton only |

## Local dev

```bash
cd services/identity
make start
```

## Production deploy

See [deploy/README.md](deploy/README.md) and [deploy/PROD_PLAN.md](deploy/PROD_PLAN.md).

Domains: **druz9.ru**, **druz9.online** — API at `api.druz9.ru`, app at `app.druz9.ru`.

```bash
cd deploy
cp .env.example .env   # fill secrets
make up
```

Root `go.work` is optional. Services build with `GOWORK=off`.
