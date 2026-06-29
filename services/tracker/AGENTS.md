# AGENTS.md — tracker service

Self-contained. Work from `services/tracker/` only.

Module: `github.com/sedorofeevd/project-druzya/services/tracker`

## Purpose

Minimal text-file-style task board: Project → Epic → Sprint → Task. **WorkTask API** (`/v1/tracker/work/*`) powers Hone kanban + schedule. User settings: **Google Calendar sync** for event tasks.

## Ports

HTTP `8089` | gRPC `9099` | PG `5441` `druzya_tracker`

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetBoard | `GET /v1/tracker/board` | JWT |
| GetToday | `GET /v1/tracker/today` | JWT |
| CreateProject | `POST /v1/tracker/projects` | JWT |
| CreateEpic | `POST /v1/tracker/epics` | JWT |
| ReopenEpic | `POST /v1/tracker/epics/{id}/reopen` | JWT |
| CreateSprint | `POST /v1/tracker/sprints` | JWT |
| CreateTask | `POST /v1/tracker/tasks` | JWT |
| UpdateTask | `PATCH /v1/tracker/tasks/{id}` | JWT |
| ListSprintTasks | `GET /v1/tracker/sprints/{sprint_id}/tasks` | JWT |
| ArchiveSprint | `POST /v1/tracker/sprints/{id}/archive` | JWT |
| ExportBoard | `GET /v1/tracker/export` | JWT |
| GetSettings | `GET /v1/tracker/settings` | JWT |
| UpdateSettings | `PATCH /v1/tracker/settings` | JWT |
| UpdateEpicSprintScope | `PATCH /v1/tracker/epics/{id}/sprint_scope` | JWT — defer epic to next sprint |
| GetGoogleCalendarAuthURL | `GET /v1/tracker/integrations/google/url` | JWT |
| DisconnectGoogleCalendar | `POST /v1/tracker/integrations/google/disconnect` | JWT |
| ListWorkTasks | `GET /v1/tracker/work/tasks` | JWT — Hone kanban (active sprint) |
| CreateWorkTask | `POST /v1/tracker/work/tasks` | JWT |
| UpdateWorkTaskStatus | `POST /v1/tracker/work/tasks/{id}/status` | JWT |
| DeleteWorkTask | `DELETE /v1/tracker/work/tasks/{id}` | JWT |
| ScheduleWorkTask | `POST /v1/tracker/work/tasks/{id}/schedule` | JWT |
| UnscheduleWorkTask | `POST /v1/tracker/work/tasks/{id}/unschedule` | JWT |
| UpdateWorkTaskKind | `POST /v1/tracker/work/tasks/{id}/kind` | JWT |

Custom HTTP (not grpc-gateway):

| Route | Purpose |
|-------|---------|
| `GET /v1/tracker/integrations/google/callback` | Google OAuth callback → redirect to `FRONTEND_URL/tasks` |

Internal (`TrackerInternalService`, `x-internal-token`): retained for future workers; no active consumer in MVP stack.

## Outbox events

| Event | When |
|-------|------|
| `tracker.task_created` | User creates task (`source=user`) |
| `tracker.task_completed` | User marks task done |

## Sprints

- One **active** sprint per project (`GetBoard.active_sprint`); archived sprints in `archived_sprints`.
- `CreateSprint` archives any existing active sprint for the project, then inserts the new sprint as active.
- Sprint proto includes `created_at` / `archived_at`, `estimate_days_used` / `estimate_days_capacity` (capacity = **10 person-days** for a 14-day sprint).
- `ReopenEpic` | `POST /v1/tracker/epics/{id}/reopen` | JWT — manual reopen after all tasks done.
- Task `estimate_days` (0.5–5, default 1); sprint capacity is **advisory** (soft overload bar in UI).

## Today plan (`GetToday`)

- **Fallback planner:** first three open sprint tasks → `today_tasks`, rest → `later_tasks` (~1.5 person-day budget metadata preserved for UI).
- Respects `deferred_sprint_epic_names` (excluded from today list).
- Client may send `local_date` + `timezone`; falls back to identity profile TZ when `IDENTITY_GRPC_ADDR` is set.

## Epics

- Tasks optionally link to an epic (`epic_id`); epic progress counts **all non-archived tasks** across sprints in the project.
- Epic `status`: `open` | `done` — auto-synced on `GetBoard` and after task changes when every linked non-archived task is `done`; reopens when a task is unchecked or a new open task is added. `ReopenEpic` sets `hold_open=true` so sync does not immediately re-close until a new open task appears.

## Data

`user_settings(user_id, smart_parse_enabled, google_calendar_sync_enabled, google_refresh_token, google_oauth_state)`

Task `metadata` includes `task_kind` (`learning` | `event` | `life` | `general` | `system`), optional `google_event_id` after Calendar sync, and Hone fields: `hone_kind`, `brief_md`, `skill_key`, `deep_link`, `manual_kind_override`.

Work board columns use `board_status` (`todo` | `in_progress` | `in_review` | `done` | `dismissed`). Schedule view uses `scheduled_start` + `scheduled_duration_min` (15–480). Soft-delete via `archived_at`.

## Google Calendar

Optional env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (must match Google Cloud OAuth app; callback path `/v1/tracker/integrations/google/callback`).

When sync enabled + refresh token present:

- **Event sprint tasks** (`task_kind=event`): create / update / delete via metadata `event_time` / `event_date`.
- **Scheduled work tasks** (`scheduled_start` + `scheduled_duration_min`): create / update / delete on schedule, unschedule, complete, archive. Same `google_event_id` metadata key.
- `PatchTaskMetadata` (e.g. smart parse) also triggers event-task sync. `DisconnectGoogleCalendar` clears refresh token and disables sync.

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
| INTERNAL_API_TOKEN | required |
| FRONTEND_URL | `http://localhost:5173` |
| IDENTITY_GRPC_ADDR | optional; profile timezone fallback for `GetToday` (default `127.0.0.1:9090`) |
| GOOGLE_CLIENT_ID | optional |
| GOOGLE_CLIENT_SECRET | optional |
| GOOGLE_REDIRECT_URI | optional |
