# Port plan — live-coding (Phase C) from druzya

Source repo: `/Users/sedorofeevd/Desktop/druzya`

## What `backend/services/rooms` actually is

**On disk today (8 files):** unified CRUD over `editor_rooms` + `whiteboard_rooms`, free-tier quota, Connect-RPC. **No WebSocket, no Yjs.**

Real-time collab lives in **`backend/services/editor`** + deleted files recoverable from git:

```bash
git -C /Users/sedorofeevd/Desktop/druzya show 562813b2:backend/services/editor/ports/ws.go          # 558 lines — Yjs hub
git -C /Users/sedorofeevd/Desktop/druzya show 562813b2:backend/services/editor/ports/ws_handler.go # 201 lines — WS upgrade
git -C /Users/sedorofeevd/Desktop/druzya show 562813b2:frontend/src/pages/EditorRoomSharePage.tsx  # 1436 lines — collab UI
git -C /Users/sedorofeevd/Desktop/druzya show 562813b2:frontend/src/lib/queries/pairEditor.ts      # WS hook + invite/freeze
```

Current monolith wires **solo editor only** (`cmd/monolith/services/editor/editor.go` — Freeze/Invite/Replay nil, no `MountWS`).

## Target in project-druzya

New service: **`services/rooms`** (HTTP `:8087`, gRPC `:9097`, PG `druzya_rooms` / `:5440`).

| Layer | Source | Target |
|-------|--------|--------|
| Schema | `backend/migrations/00002_tables.sql` (`editor_rooms`, `editor_participants`) | `scripts/migrations/00001_init_rooms.sql` |
| Domain | `editor/domain/*.go` | `internal/room/model/` |
| Use cases | `editor/app/create_room.go`, `get_room.go`, `invite.go`, `freeze.go` | `internal/room/service/` |
| Quota | `rooms/app/usecases.go` (optional) | billing `CheckEntitlement` instead of `user_room_quota` |
| REST | `proto/druz9/v1/editor.proto` | `api/rooms/v1/rooms.proto` + grpc-gateway |
| WS hub | git `ws.go` | `internal/ws/hub.go` |
| WS handler | git `ws_handler.go` | `internal/ws/handler.go` |
| JWT | druzya scoped JWT + guest | identity JWT `sub` + participant row; add `POST /v1/rooms/{id}/join` for invite token later |
| Run code | editor Judge0 | **sandbox** `/v1/sandbox/code-runs` (already exists) |
| Frontend | git `EditorRoomSharePage.tsx` | `apps/web/src/pages/CollabRoomPage.tsx` |
| Caddy | — | `handle /ws/editor/* { reverse_proxy rooms:8087 }` |

## WS protocol (keep as-is)

Path: `GET /ws/editor/{roomId}?token=<JWT>`

Envelope: `{ "kind": string, "data": object }`

| Direction | kind | Purpose |
|-----------|------|---------|
| S→C | `snapshot` | full Y.Doc state on join |
| S→C | `op` | Yjs update `{ seq, user_id, payload }` |
| S→C | `cursor` | presence |
| S→C | `freeze` | room frozen |
| C→S | `op`, `snapshot`, `cursor`, `ping` | edit / presence |

Roles: `owner`, `interviewer`, `participant`, `viewer` — map to product labels interviewer/candidate.

## Port order (2–3 weeks)

### Week 1 — Backend skeleton
1. Finish `services/rooms` from template (rename cmd/api paths, ports 8087/9097/5440)
2. Migration + repository (port `editor/infra/postgres.go`)
3. Proto: `CreateRoom`, `GetRoom`, `JoinRoom`, `FreezeRoom`, `CreateInvite`
4. grpc-gateway + identity JWT interceptor (copy interview pattern)
5. Restore `internal/ws/hub.go` + `handler.go` from git; adapt imports + `identity/pkg/jwt`
6. `server.go`: mount `GET /ws/editor/{roomId}` beside gateway

### Week 2 — Frontend collab
1. Add deps to `apps/web`: `yjs`, `y-codemirror.next`, `@codemirror/*`
2. Port `pairEditor.ts` → `lib/ws/collabRoom.ts` (WS URL + REST)
3. Port `EditorRoomSharePage.tsx` → `CollabRoomPage.tsx` (trim whiteboard/tutor deps)
4. Route `/live/:roomId`; link from interview session ("Open collab room")
5. Vite proxy `/ws` → `:8087`; Caddy prod route

### Week 3 — Polish
1. Invite links (HMAC from `editor/app/invite.go`)
2. Freeze + replay buffer flush
3. billing quota gate on create
4. E2E: interviewer + candidate two browsers

## Commands to bootstrap service

```bash
cd services
cp -R template rooms
# rename template→rooms, example→room, ports 8087/9097/5440 (see root AGENTS.md)
cd rooms
make gen-proto && make migrate-new NAME=init_rooms
# paste ws files from git into internal/ws/
make build
```

## Gaps to resolve during port

| druzya | project-druzya action |
|--------|----------------------|
| Connect-RPC | grpc-gateway proto |
| `VerifyScopedFull` guest JWT | Phase C v1: both users login; v2: invite token → join RPC |
| `users` FK on participants | store `user_id` UUID from identity only (no FK) |
| Judge0 on editor | sandbox service |
| `user_room_quota` | billing entitlements |
