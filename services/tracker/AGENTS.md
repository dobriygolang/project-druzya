# AGENTS.md — tracker service

Self-contained. Work from `services/tracker/` only.

Module: `github.com/sedorofeevd/project-druzya/services/tracker`

## Purpose

Minimal text-file-style task board: Project → Epic → Sprint → Task. Emits outbox events consumed by recommendation-service for enrichment and completion loops.

User settings: **smart parse** (AI re-classification via recommendation → ai-service) and **Google Calendar sync** for event tasks.

## Ports

HTTP `8089` | gRPC `9099` | PG `5441` `druzya_tracker`

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetBoard | `GET /v1/tracker/board` | JWT |
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
| GetGoogleCalendarAuthURL | `GET /v1/tracker/integrations/google/url` | JWT |
| DisconnectGoogleCalendar | `POST /v1/tracker/integrations/google/disconnect` | JWT |

Custom HTTP (not grpc-gateway):

| Route | Purpose |
|-------|---------|
| `GET /v1/tracker/integrations/google/callback` | Google OAuth callback → redirect to `FRONTEND_URL/tasks` |

Internal (`TrackerInternalService`, `x-internal-token`):

| RPC | Used by |
|-----|---------|
| ClaimOutboxEvents / Ack / Fail | recommendation worker |
| EnsureLearningBoard | recommendation |
| CreateTaskInternal | recommendation |
| GetSprintPreview | recommendation (optional) |
| GetUserSettings | recommendation (smart parse gate) |
| PatchTaskMetadata | recommendation (smart parse merge + epic from `epic_hint`) |

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
- Task `estimate_days` (0.5–5, default 1); create/update rejected if sprint sum exceeds capacity (`FailedPrecondition`).
+- Task `estimate_days` (0.5–5, default 1); sprint `estimate_days_used` vs capacity (5) is **advisory** — UI warns when over, API does not block.

## Epics

- Tasks optionally link to an epic (`epic_id`); epic progress counts **all non-archived tasks** across sprints in the project.
- Epic `status`: `open` | `done` — auto-synced on `GetBoard` and after task changes when every linked non-archived task is `done`; reopens when a task is unchecked or a new open task is added. `ReopenEpic` forces `open` without new tasks.

## Data

`user_settings(user_id, smart_parse_enabled, google_calendar_sync_enabled, google_refresh_token, google_oauth_state)`

Task `metadata` includes `task_kind` (`learning` | `event` | `life` | `general` | `system`), optional `google_event_id` after Calendar sync.

## Google Calendar

Optional env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (must match Google Cloud OAuth app; callback path `/v1/tracker/integrations/google/callback`).

When sync enabled + refresh token present, event tasks (`task_kind=event`) sync to primary calendar: **create** on new task, **update** on title/time change, **delete** on complete. `PatchTaskMetadata` (e.g. smart parse) also triggers sync. `DisconnectGoogleCalendar` clears refresh token and disables sync.

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
| GOOGLE_CLIENT_ID | optional |
| GOOGLE_CLIENT_SECRET | optional |
| GOOGLE_REDIRECT_URI | optional |
