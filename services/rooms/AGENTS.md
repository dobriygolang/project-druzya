# AGENTS.md — rooms service

Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/rooms`

## Purpose

Live collab rooms: REST lifecycle + WebSocket Yjs sync for **code** (`Y.Text code`) and **system design** (Excalidraw: `Y.Map elements` + `Y.Array elementIds` + `Y.Map files`; legacy `Y.Text scene` auto-migrated).

Room types in prod UI: `practice` (code), `system_design` (Excalidraw). Legacy DB values `interview`, `pair_mock` may still exist.

## Ports

HTTP `8087` | gRPC `9097` | PG `5440` / `druzya_rooms`

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetRoom | `GET /v1/rooms/{room_id}` | JWT |
| FreezeRoom | `POST /v1/rooms/{room_id}/freeze` | JWT (owner) |
| CreateInvite | `POST /v1/rooms/{room_id}/invite` | JWT |
| GuestJoin | `POST /v1/rooms/{room_id}/guest-join` | no |
| CreateGuestRoom | `POST /v1/rooms/guest-create` | no |
| CloseRoom | `POST /v1/rooms/{room_id}/close` | JWT |
| ShareWhiteboard | `POST /v1/rooms/share-whiteboard` | JWT |
| GetInitialScene | `GET /v1/rooms/{room_id}/initial-scene` | JWT |
| PublishWhiteboard | `POST /v1/rooms/publish-whiteboard` | JWT |
| GetPublishedBoard | `GET /v1/rooms/boards/public/{slug}` | no |

WebSocket: `GET /ws/editor/{room_id}?token=JWT`.

**Whiteboard (Hone):** `ShareWhiteboard` seeds an Excalidraw scene and returns a live room + invite. `PublishWhiteboard` stores a read-only snapshot; `GetPublishedBoard` serves it by slug.

Frontend: `/live/new` — public create via `CreateGuestRoom`; guest flow mints scoped JWT via identity s2s. `/live/:roomId` → `CollabRoomPage.tsx` (CodeMirror or Excalidraw by `room_type`).

Roles: `owner`, `participant`, `viewer`. Legacy DB value `interviewer` may still exist on old rooms.

## Scale

Yjs state is **in-process** per pod. Default: single replica. Multiple replicas need sticky sessions on `/ws/*` — see [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md).

## Commands

```bash
cd services/rooms
make start   # JWT_PUBLIC_KEY_FILE=../identity/scripts/dev/jwt/public.pem
make gen-proto | build
```

Env: JWT, `INTERNAL_API_TOKEN`, `IDENTITY_GRPC_ADDR`, `ROOM_INVITE_SECRET`, `ROOM_TTL` (6h).
