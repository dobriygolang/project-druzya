# AGENTS.md — tracker service

Self-contained. Work from `services/tracker/` only.

Module: `github.com/sedorofeevd/project-druzya/services/tracker`

## Purpose

Hone work task board: kanban columns + day schedule. User settings include optional **Google Calendar sync** for scheduled tasks.

## Ports

HTTP `8089` | gRPC `9099` | PG `5441` `druzya_tracker`

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetSettings | `GET /v1/tracker/settings` | JWT |
| UpdateSettings | `PATCH /v1/tracker/settings` | JWT |
| GetGoogleCalendarAuthURL | `GET /v1/tracker/integrations/google/url` | JWT |
| DisconnectGoogleCalendar | `POST /v1/tracker/integrations/google/disconnect` | JWT |
| ListGoogleCalendarEvents | `GET /v1/tracker/integrations/google/events` | JWT |
| ListWorkTasks | `GET /v1/tracker/work/tasks` | JWT |
| CreateWorkTask | `POST /v1/tracker/work/tasks` | JWT |
| UpdateWorkTaskStatus | `POST /v1/tracker/work/tasks/{id}/status` | JWT |
| DeleteWorkTask | `DELETE /v1/tracker/work/tasks/{id}` | JWT |
| ScheduleWorkTask | `POST /v1/tracker/work/tasks/{id}/schedule` | JWT |
| UnscheduleWorkTask | `POST /v1/tracker/work/tasks/{id}/unschedule` | JWT |

Custom HTTP (not grpc-gateway):

| Route | Purpose |
|-------|---------|
| `GET /v1/tracker/integrations/google/callback` | Google OAuth callback → redirect to `HONE_CALLBACK_URL` (default `hone://settings?google_calendar=…`) |

## Outbox events

Removed — no background consumers; `domain_outbox` dropped in migration `00008`.

## Data

`work_tasks(user_id, status, kind, title, scheduled_start, scheduled_duration_min, google_event_id, archived_at, …)`

Statuses: `todo` | `in_progress` | `in_review` | `done` | `dismissed`. Schedule duration 15–480 minutes. Soft-delete via `archived_at`.

`user_settings(user_id, google_calendar_sync_enabled, google_refresh_token, google_oauth_state)`

## Google Calendar

Optional env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (callback path `/v1/tracker/integrations/google/callback`).

When sync enabled + refresh token present, scheduled work tasks create/update/delete Google Calendar events via `google_event_id`. `DisconnectGoogleCalendar` clears refresh token and disables sync.

## Commands

```bash
cd services/tracker
make start | gen-proto | test | lint | build
```

## Env

| Variable | Default |
|----------|---------|
| HTTP_PORT | 8089 |
| GRPC_PORT | 9099 |
| POSTGRES_DSN | localhost:5441 / `druzya_tracker` |
| JWT_PUBLIC_KEY / JWT_PUBLIC_KEY_FILE | required |
| INTERNAL_API_TOKEN | required (reserved; no internal RPCs yet) |
| HONE_CALLBACK_URL | `hone://settings` — deep link after Google Calendar OAuth |
| GOOGLE_CLIENT_ID | optional |
| GOOGLE_CLIENT_SECRET | optional |
| GOOGLE_REDIRECT_URI | optional |
