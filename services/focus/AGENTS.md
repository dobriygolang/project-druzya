# AGENTS.md — focus service

Work from `services/focus/` only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/focus`

## Purpose

Pomodoro timer and focus statistics for Hone Electron:

- `StartFocusSession` / `EndFocusSession` — JWT-protected
- `GetStats` — streaks, heatmap, last 7 days, total focused seconds
- Optional link to tracker task via `task_id` (Hone `planItemId`)

## Ports

HTTP `8091` | gRPC `9101` | PG `5443` / `druzya_focus`

## HTTP (grpc-gateway)

| Method | Path |
|--------|------|
| POST | `/v1/focus/sessions/start` |
| POST | `/v1/focus/sessions/{session_id}/end` |
| GET | `/v1/focus/stats?up_to_date=YYYY-MM-DD` |

## Env

| Var | Default (dev) |
|-----|---------------|
| `HTTP_PORT` | `8091` |
| `GRPC_PORT` | `9101` |
| `POSTGRES_DSN` | `postgres://postgres:postgres@localhost:5443/druzya_focus?sslmode=disable` |
| `JWT_PUBLIC_KEY` or `JWT_PUBLIC_KEY_FILE` | required (identity RS256 public key) |

## Data model

- `focus_sessions` — one row per session; `task_id` optional UUID
- `focus_streaks` — per-user current/longest streak + `last_active_date`

## Commands

```bash
cd services/focus
make start | gen-proto | test | lint | build
```

Build: `GOWORK=off`
