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

## Onboarding (architecture)

New team members: [docs/onboarding/](docs/onboarding/) — Excalidraw diagrams + service/data map.

## Frontend (MVP → legacy UI migration)

React SPA: [apps/web/](apps/web/) — phased port from legacy `druzya/frontend` onto microservices.

**Migration plan:** [apps/web/MIGRATION.md](apps/web/MIGRATION.md)  
**Dev tracker:** `npm run dev` → open `/migration`

```bash
cd apps/web && npm install && npm run dev
```

Requires backend services on ports 8080–8087 (identity, content, interview, recommendation, billing, sandbox, rooms).

## Local dev

```bash
cd services/identity
make start
```

## Production deploy

See [deploy/PRODUCTION_CHECKLIST.md](deploy/PRODUCTION_CHECKLIST.md) and [deploy/RUNBOOK.md](deploy/RUNBOOK.md).

Canonical site: **https://druz9.online** — API at `api.druz9.online`; **druz9.ru** redirects to `.online`.

```bash
cd deploy
cp .env.example .env   # fill secrets
make up
```

Root `go.work` is optional. Services build with `GOWORK=off`.
