# apps/web — Hone companion site

Thin web surface: landing, guest live collab, public pricing/legal, published notes and boards.

See [AGENTS.md](./AGENTS.md) for full route and API map.

## Active routes

| Route | Purpose |
|-------|---------|
| `/welcome` | Landing (download, philosophy) |
| `/live/new`, `/live/:roomId` | Guest code / Excalidraw rooms |
| `/notes/:slug` | Public published note |
| `/board/:slug` | Public published whiteboard |
| `/pricing` | Plan comparison |
| `/legal/*` | Privacy, terms |

Retired routes (`/login`, `/profile`, `/checkout`, interview paths) redirect to `/welcome` or `/pricing`.

## Dev

```bash
cd services/identity && make start
cd services/billing && make start
cd services/sandbox && make start
cd services/rooms && make start
cd services/notes && make start   # published notes
cd apps/web && npm install && npm run dev
```

Auth lives in **Hone desktop** — web clears JWT on load.
