# Onboarding — project-druzya

Architecture overview for new team members.

## Diagrams

Open `.excalidraw` files with **Excalidraw** extension in Cursor (not as plain JSON).

| File | Content |
|------|---------|
| [00-master-architecture.excalidraw](./00-master-architecture.excalidraw) | Main diagram |
| 01–05 | Overview, services/data, sync comms, async flows, user journeys |

Regenerate: `python3 docs/onboarding/generate_excalidraw.py`

## Platform (one page)

```
Browser → Caddy/Vite → identity | content | interview | ai | recommendation | billing | sandbox | rooms
```

**Rule:** each service has its own Postgres. Cross-service data only via gRPC adapters.

Service details: `services/<name>/AGENTS.md`. Ports: [AGENTS.md](../../AGENTS.md#port-allocation-defaults).

## gRPC dependencies

| From | To | Why |
|------|-----|-----|
| interview | content, billing, **recommendation** | templates, quota, **task picker hints** |
| ai | interview, content, billing | outbox, bundle, eval quota |
| recommendation | interview, content | outbox, articles, **mock progress** |
| sandbox | content, interview, billing | tests, submit, runs |
| rooms | identity, billing | guest JWT, room quota |
| billing | identity | telegram → user |

## Outbox (interview → async)

| Event | Consumer |
|-------|----------|
| `attempt_submitted` | ai |
| `attempt_evaluated`, `session_completed`, `retry_item_created`, `task_skipped` | recommendation (skills + **mock progress**) |

Mock progress & picking: [docs/architecture/mock-progress.md](../architecture/mock-progress.md).

Each worker claims only its events (not `*`).

## Local dev

```bash
cd services/identity && make start
cd apps/web && npm install && npm run dev   # :5173
```

Prod ops: [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md).

## First week

- [ ] Excalidraw diagrams + this doc
- [ ] [AGENTS.md](../../AGENTS.md) + [.cursor/rules/architecture-standard.mdc](../../.cursor/rules/architecture-standard.mdc)
- [ ] Login → mock session → sandbox run → submit attempt → **results outcome badge**
- [ ] Read `docs/architecture/mock-progress.md` + `services/interview/AGENTS.md` (outbox, picking)
