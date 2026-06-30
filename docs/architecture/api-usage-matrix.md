# API usage matrix

Source of truth for which RPCs/endpoints are used by **hone** and **web** clients.

Legend: **hone** | **web** | **none** | **s2s**

## identity

| RPC / HTTP | hone | web |
|------------|------|-----|
| `GET /v1/auth/config`, `POST /v1/auth/telegram` | yes | — |
| Tauri `/api/v1/auth/telegram/*` | yes | — |
| `HEAD /healthz` | yes | — |
| gRPC s2s | s2s | s2s |

## billing

| RPC / HTTP | hone | web |
|------------|------|-----|
| `GET /v1/billing/plans` | — | yes |
| gRPC CheckEntitlements, ConsumeUsage | s2s | s2s |

## tracker

| RPC / HTTP | hone | web |
|------------|------|-----|
| `/v1/tracker/work/tasks/*` | yes | — |
| Google Calendar integration | yes | — |
| `/v1/tracker/settings` | yes | — |
| Learning board (`/board`, `/today`, sprints) | — | — | **removed** |

## notes

| RPC / HTTP | hone | web |
|------------|------|-----|
| Notes CRUD, vault | yes | — |
| share-to-web, unpublish, make-private, publish-status | yes | — |
| `GET /v1/notes/public/{slug}` | — | yes |
| Folders, move, meta, PublishNote, PermanentlyDecryptNote | — | — | **removed** |

## focus

| RPC / HTTP | hone | web |
|------------|------|-----|
| sessions start/end, stats | yes | — |

## rooms

| RPC / HTTP | hone | web |
|------------|------|-----|
| guest-create, get, guest-join, freeze, invite, close | — | yes |
| share-whiteboard, publish-whiteboard | yes | — |
| `GET initial-scene` | — | yes |
| `GET boards/public/{slug}` | — | yes |
| FreezeRoom | — | yes (owner) |
| CreateRoom, JoinRoom, ListMyActiveRooms, GetReplay | — | — | **removed** |
| `WS /ws/editor/{roomId}` | — | yes |

## sandbox

| RPC / HTTP | hone | web |
|------------|------|-----|
| code-runs, format | — | yes |
| `run_type` request field | — | — | **removed** (custom only) |
| ListCodeRuns, SubmitAttemptFromCodeRun | — | — | **removed** |

## ai (CI only)

All RPCs: **none** — **ARCHIVED**.

## template

Skeleton only — **none**.
