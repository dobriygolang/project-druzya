# AGENTS.md — rooms service

Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/rooms`

## Purpose

Live collab rooms: REST lifecycle + WebSocket Yjs sync for **code** (`Y.Text code`) and **system design** (`Y.Text scene` / Excalidraw JSON).

Room types: `practice`, `interview`, `pair_mock`, `system_design`. Languages include `diagram` for Excalidraw boards.

## Ports

HTTP `8087` | gRPC `9097` | PG `5440` / `druzya_rooms`

## API

REST: `POST/GET /v1/rooms/*`, guest join, invite. WS: `GET /ws/editor/{room_id}?token=JWT`.

Roles: `owner`, `interviewer`, `participant`, `viewer`.

Frontend: `/live/:roomId` → `CollabRoomPage.tsx` (CodeMirror or Excalidraw by `room_type`).

## Scale

Yjs state is **in-process** per pod. Default: single replica. Multiple replicas need sticky sessions on `/ws/*` — see [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md).

## Commands

```bash
cd services/rooms
make start   # JWT_PUBLIC_KEY_FILE=../identity/scripts/dev/jwt/public.pem
make gen-proto | build
```

Env: JWT, `INTERNAL_API_TOKEN`, `IDENTITY_GRPC_ADDR`, `BILLING_GRPC_ADDR`, `ROOM_INVITE_SECRET`, `ROOM_TTL` (6h).
