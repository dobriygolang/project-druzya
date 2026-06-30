# Onboarding — project-druzya

Architecture overview for the **Hone productivity stack**.

## Platform (current)

```
Hone (Tauri desktop) ──HTTP──► identity | tracker | notes | focus
Web (landing + live) ──HTTP/WS──► identity | billing | rooms | sandbox | notes (public)
```

Each service has its own Postgres. Cross-service calls via gRPC adapters only.

| Client | Docs |
|--------|------|
| Hone desktop | [apps/hone/AGENTS.md](../../apps/hone/AGENTS.md) |
| Web companion | [apps/web/AGENTS.md](../../apps/web/AGENTS.md) |
| Backend services | [AGENTS.md](../../AGENTS.md) |
| API usage matrix | [api-usage-matrix.md](../architecture/api-usage-matrix.md) |

Ports: [AGENTS.md — port allocation](../../AGENTS.md#port-allocation-defaults).

## Active services (prod)

| Service | Purpose | Clients |
|---------|---------|---------|
| identity | Telegram auth, JWT | hone, web (refresh only) |
| tracker | Work tasks, Google Calendar | hone |
| notes | Notes CRUD, vault, publish | hone, web (public slug) |
| focus | Pomodoro sessions, stats | hone |
| rooms | Live collab, Yjs WS, board publish | web, hone (share) |
| sandbox | Code run, format | web (live rooms) |
| billing | Plans, entitlements | web (pricing), notes/rooms (gates) |

**CI only (not prod):** ai — archived interview-era LLM gateway.

## gRPC dependencies (active)

| From | To | Why |
|------|-----|-----|
| notes | billing | `cloud_notes_count` gate on create |
| rooms | identity | scoped guest JWT mint |
| rooms | billing | live room quotas |
| sandbox | billing | code run quotas |
| tracker | identity | profile timezone fallback (optional) |

## Cross-app flows

### Hone sync (when `LOCAL_ONLY=false`)

IndexedDB outbox → notes/tasks/focus HTTP APIs. LWW merge by `updatedAt`. See [hone AGENTS — Sync engine](../../apps/hone/AGENTS.md#sync-engine).

### Note publish

Hone `share-to-web` → notes service stores slug → web `/notes/{slug}` (public, no auth).

### Whiteboard share

- **Live:** hone `share-whiteboard` → rooms service → web `/live/{roomId}`
- **Publish:** hone `publish-whiteboard` → rooms DB → web `/board/{slug}` read-only

### Live collab (web)

Guest creates room → scoped JWT → WS `/ws/editor/{roomId}`. Code (`practice`) or Excalidraw (`system_design`).

## Retired services

Removed from repo; do not reference in new code.

| Service | Was | Replaced by |
|---------|-----|-------------|
| content | Articles, templates | — (removed) |
| interview | Mock interviews, sessions | — (removed) |
| recommendation | Task picking, progress | — (removed) |
| admin | Operator BFF | — (removed) |

Legacy docs archived under [docs/archive/](../archive/).

## Local dev

**Hone:**

```bash
cd apps/hone && cp .env.example .env && npm install && npm run dev
# Optional cloud sync: VITE_HONE_LOCAL_ONLY=false + VITE_HONE_LOCAL_API=true
```

**Web + live rooms:**

```bash
cd services/identity && make start
cd services/billing && make start
cd services/sandbox && make start
cd services/rooms && make start
cd services/notes && make start
cd apps/web && npm install && npm run dev
```

**Full hone backend:**

```bash
# identity, tracker, notes, focus on default ports
cd services/tracker && make start
cd services/focus && make start
```

Prod ops: [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md).

## First week checklist

- [ ] Read [AGENTS.md](../../AGENTS.md) + [architecture-standard.mdc](../../.cursor/rules/architecture-standard.mdc)
- [ ] Read [apps/hone/AGENTS.md](../../apps/hone/AGENTS.md) or [apps/web/AGENTS.md](../../apps/web/AGENTS.md) for your area
- [ ] Skim [api-usage-matrix.md](../architecture/api-usage-matrix.md)
- [ ] Run hone locally; try notes, task board, whiteboard
- [ ] Run web `/live/new` with local rooms + sandbox

## Diagrams

Open `.excalidraw` files in `docs/onboarding/` with Excalidraw extension. Regenerate: `python3 docs/onboarding/generate_excalidraw.py`.

**Note:** older diagrams may show retired services — treat this README as source of truth.
