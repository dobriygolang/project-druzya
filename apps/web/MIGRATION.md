# apps/web — Hone companion site

Thin web surface for the Hone desktop app: landing, auth, billing, legal, and guest live collab rooms.

## Routes

| Route | Purpose |
|-------|---------|
| `/welcome` | Landing (download, philosophy, pricing) |
| `/login`, `/auth/callback` | OAuth (shared JWT with Hone) |
| `/profile` | Account + billing limits |
| `/pricing`, `/checkout`, `/billing/welcome` | Tribute checkout |
| `/live/new`, `/live/:roomId` | Guest code / whiteboard rooms |
| `/legal/*` | Privacy, terms |

Retired interview-prep routes redirect to `/welcome`.

## Dev

```bash
cd services/identity && make start
# + billing, sandbox, rooms as needed for live rooms
cd apps/web && npm install && npm run dev
```
