# AGENTS.md — rooms service

Monorepo index: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/rooms`

## Purpose

Live coding collab: REST room lifecycle + WebSocket Yjs sync.

| Layer | Path |
|-------|------|
| Domain | `internal/room/model/`, `internal/room/service/` |
| Persistence | `internal/room/repository/` |
| WS hub | `internal/ws/` — port from druzya `editor/ports/ws.go` |
| Transport | `internal/app/api/rooms/` — one RPC per file |
| Custom HTTP | `GET /ws/editor/{roomId}?token=JWT` in `cmd/rooms/app/server.go` |

## API

| RPC | HTTP |
|-----|------|
| CreateRoom | `POST /v1/rooms` |
| GetRoom | `GET /v1/rooms/{room_id}` |
| JoinRoom | `POST /v1/rooms/{room_id}/join` |
| FreezeRoom | `POST /v1/rooms/{room_id}/freeze` |
| CreateInvite | `POST /v1/rooms/{room_id}/invite` |
| GetReplay | `GET /v1/rooms/{room_id}/replay` |
| GuestJoin | `POST /v1/rooms/{room_id}/guest-join` (no auth; invite HMAC + scoped JWT) |
| WS Yjs | `GET /ws/editor/{room_id}?token=JWT` |

Roles: `owner`, `interviewer`, `participant`, `viewer`.

## Ports

| Protocol | Value |
|----------|-------|
| HTTP | 8087 |
| gRPC | 9097 |
| Postgres | 5440 / `druzya_rooms` |

## Commands

```bash
cd services/rooms
make start          # needs JWT_PUBLIC_KEY_FILE=../identity/scripts/dev/jwt/public.pem
make gen-proto
make build
```

## Env

| Variable | Required |
|----------|----------|
| `JWT_PUBLIC_KEY` or `JWT_PUBLIC_KEY_FILE` | yes (same as identity) |
| `INTERNAL_API_TOKEN` | yes (identity + billing s2s) |
| `IDENTITY_GRPC_ADDR` | default `127.0.0.1:9090` |
| `BILLING_GRPC_ADDR` | optional; skips billing if empty |
| `ROOM_INVITE_SECRET` | prod required |
| `POSTGRES_DSN` | default localhost:5440 |
| `PUBLIC_BASE_URL` | share links (default http://localhost:5173) |
| `ROOM_TTL` | default 6h |

## Frontend

- Route: `/live/:roomId` — `apps/web/src/pages/CollabRoomPage.tsx`
- Vite proxies `/v1/rooms` and `/ws` → `:8087`
- Caddy: `handle /ws/*` + `/v1/rooms*` → `rooms:8087`
