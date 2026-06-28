# project-druzya

Monorepo of **independent microservices**. Each service is self-contained — open its folder and read local `AGENTS.md`.

## Services

| Service | Path | Prod |
|---------|------|------|
| identity | [services/identity/](services/identity/) | yes |
| content | [services/content/](services/content/) | yes |
| interview | [services/interview/](services/interview/) | yes |
| ai | [services/ai/](services/ai/) | yes |
| recommendation | [services/recommendation/](services/recommendation/) | yes |
| billing | [services/billing/](services/billing/) | yes |
| sandbox | [services/sandbox/](services/sandbox/) | yes |
| rooms | [services/rooms/](services/rooms/) | yes |
| admin | [services/admin/](services/admin/) | yes |
| template | [services/template/](services/template/) | skeleton only |

Ports and DB names: [AGENTS.md](AGENTS.md#port-allocation-defaults).

## Docs

| Doc | For |
|-----|-----|
| [AGENTS.md](AGENTS.md) | Monorepo index, service template |
| [docs/onboarding/](docs/onboarding/) | Architecture diagrams + service map |
| [apps/web/MIGRATION.md](apps/web/MIGRATION.md) | Frontend port status |
| [deploy/PRODUCTION_CHECKLIST.md](deploy/PRODUCTION_CHECKLIST.md) | First prod deploy |
| [deploy/RUNBOOK.md](deploy/RUNBOOK.md) | Ops, incidents, LLM tuning |

## Local dev

```bash
cd services/identity && make start   # JWT keys + Postgres + Redis
cd apps/web && npm install && npm run dev   # :5173, proxies /v1
```

## Production

Canonical site: **https://druz9.online** — API `api.druz9.online`; `druz9.ru` → `.online`.

```bash
cd deploy && cp .env.example .env && make keys && make up
```

Root `go.work` is optional. Services build with `GOWORK=off`.
