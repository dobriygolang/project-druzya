# AGENTS.md — Web companion (Hone)

Work from `apps/web/` only. Desktop app: [../hone/AGENTS.md](../hone/AGENTS.md). Monorepo: [../../AGENTS.md](../../AGENTS.md).

## Purpose

Thin public web surface for Hone: landing + download, guest live collab (code + Excalidraw), public pricing, legal pages, published notes and whiteboards. **No user auth** on web — JWT cleared on boot; live rooms use scoped guest tokens.

## Scope (active)

| Area | Routes |
|------|--------|
| Landing | `/welcome` |
| Live collab | `/live/new`, `/live/:roomId` |
| Public notes | `/notes/:slug`, `/n/:slug` → redirect |
| Public boards | `/board/:slug` |
| Pricing | `/pricing` |
| Legal | `/legal/terms`, `/legal/privacy` |

Retired routes redirect to `/welcome` or `/pricing` (see below).

## Routes

Defined in `src/App.tsx`:

| Route | Page | Auth |
|-------|------|------|
| `/` | → `/welcome` | — |
| `/welcome` | `WelcomePage` | — |
| `/notes/:slug` | `PublishedNotePage` | — |
| `/n/:slug` | → `/notes/:slug` | — |
| `/board/:slug` | `PublishedBoardPage` | — |
| `/live/new` | `CollabRoomPage` → `LiveNewPage` | guest |
| `/live/:roomId` | `CollabRoomPage` | guest JWT |
| `/pricing` | `PricingPage` | — |
| `/legal/terms` | `LegalTermsPage` | — |
| `/legal/privacy` | `LegalPrivacyPage` | — |
| `/login`, `/profile`, `/settings`, `/auth/callback` | → `/welcome` | retired |
| `/checkout`, `/billing/welcome` | → `/pricing` | retired |
| `/today`, `/dashboard`, `/learn/*`, `/mock/*`, `/interview/*`, `/tasks`, `/admin/*` | → `/welcome` | retired |

## Backend dependencies

Base: `VITE_API_BASE` (default `/v1`). Dev proxy: `vite.config.ts`.

| Service | Port | Proxy prefix |
|---------|------|--------------|
| identity | 8080 | `/v1/auth`, `/v1/me` |
| billing | 8085 | `/v1/billing` |
| sandbox | 8086 | `/v1/sandbox`, `/ws/lsp` |
| rooms | 8087 | `/v1/rooms`, `/ws` |
| notes | 8090 | `/v1/notes` |

### REST endpoints (active)

**billing** — `lib/api/billing.ts`

| Method | Path | Used by |
|--------|------|---------|
| GET | `/v1/billing/plans` | `PricingPage` |

**rooms** — `lib/api/rooms.ts`

| Method | Path | Used by |
|--------|------|---------|
| POST | `/v1/rooms/guest-create` | `/live/new` |
| GET | `/v1/rooms/{id}` | `CollabRoomPage` |
| POST | `/v1/rooms/{id}/guest-join` | invite flow |
| POST | `/v1/rooms/{id}/freeze` | owner controls |
| POST | `/v1/rooms/{id}/invite` | owner controls |
| POST | `/v1/rooms/{id}/close` | owner controls |
| GET | `/v1/rooms/boards/public/{slug}` | `PublishedBoardPage` |

**sandbox** — `lib/api/sandbox.ts`

| Method | Path | Used by |
|--------|------|---------|
| POST | `/v1/sandbox/code-runs` | code rooms |
| GET | `/v1/sandbox/code-runs/{id}` | run polling |
| POST | `/v1/sandbox/format` | Go format |

**notes** — `lib/api/publicNotes.ts`

| Method | Path | Used by |
|--------|------|---------|
| GET | `/v1/notes/public/{slug}` | `PublishedNotePage` |

### WebSockets

| Path | Service | Client |
|------|---------|--------|
| `WS /ws/editor/{roomId}?token=JWT` | rooms | `lib/ws/collabEditor.ts` |
| `WS /ws/lsp/go?token=JWT` | sandbox | not wired in editor (future) |

WS envelope kinds: `snapshot`, `op`, `presence`, `cursor`, `freeze`.

## Guest JWT flow

1. `/live/new` → `POST /v1/rooms/guest-create` → scoped JWT + room
2. Token stored: `sessionStorage['druzya_guest_token_{roomId}']`
3. Room REST + WS use guest token via `readGuestToken(roomId)`
4. Joining is open: a direct visit to `/live/:roomId` (with or without `?invite=`) shows a name prompt → `POST guest-join` → guest token. The `invite_token` is optional on the backend; shared rooms accept anyone by URL.

Sandbox run/format should use guest token when in live room (same as room REST).

## Live collab

| Mode | `room_type` | Editor |
|------|-------------|--------|
| Code | `practice` | `CollabCodeEditor` (CodeMirror + Yjs) |
| Diagram | `system_design` | `CollabExcalidrawEditor` |

Yjs Excalidraw schema: `lib/collab/excalidrawYjsDoc.ts` — maps `elements`, `elementIds`, `files`.

Room types in prod UI: `practice`, `system_design` only.

## Hone integration

| Feature | Hone action | Web result |
|---------|-------------|------------|
| Note share | `POST /v1/notes/{id}/share-to-web` | `/notes/{slug}` |
| Whiteboard live share | `POST /v1/rooms/share-whiteboard` | `/live/{roomId}?invite=...` |
| Whiteboard publish | `POST /v1/rooms/publish-whiteboard` | `/board/{slug}` |

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE` | `/v1` | API prefix |
| `VITE_HONE_DOWNLOAD_MAC` | — | Landing download URL |
| `VITE_HONE_DOWNLOAD_WIN` | — | Landing download URL |
| `VITE_HONE_HERO_VIDEO` | — | Landing hero video |

## Commands

```bash
cd apps/web
npm install
npm run dev    # :5173, proxies to local services
npm run build
```

Local stack for live rooms:

```bash
cd services/identity && make start
cd services/billing && make start
cd services/sandbox && make start
cd services/rooms && make start
cd services/notes && make start   # published notes
```

## Layout

```
apps/web/src/
├── App.tsx              # routes
├── pages/               # Welcome, CollabRoom, Pricing, Legal, Published*
├── components/          # landing, collab editors, shell
├── lib/
│   ├── api/             # REST clients
│   ├── ws/              # collab WebSocket
│   └── collab/          # Excalidraw Yjs helpers
└── widgets/             # (via components/)
```

## Retired (removed from routing)

Auth, profile, checkout pages and their API helpers were removed. Auth lives in Hone desktop only.
