# AGENTS.md — Hone desktop app

Work from `apps/hone/` only. Monorepo index: [../../AGENTS.md](../../AGENTS.md). Web companion: [../web/AGENTS.md](../web/AGENTS.md).

## Purpose

Tauri 2 + React desktop focus workspace: pomodoro timer, notes (E2EE vault), task board with day schedule, local Excalidraw whiteboard, stats/calendar overlays, settings. Local-first IndexedDB; optional cloud sync when signed in and `LOCAL_ONLY=false`.

## Stack

| Layer | Path |
|-------|------|
| Native shell | `src-tauri/` — auth keychain, vault passphrase, pomodoro snapshot, deep links |
| Renderer | `src/renderer/src/` — React + Vite |
| Local DB | IndexedDB `hone-db` v2 — `shared/db/honeDb.ts` |
| Sync | `shared/sync/` — outbox push + pull (notes, tasks, focus) |
| Platform bridge | `platform/ipc.ts`, `platform/native-bridge.ts` → `window.hone` |

## Pages and navigation

Dock pages (`widgets/Dock.tsx`): `home`, `today`, `notes`, `whiteboard`, `settings`.

| Page | Component | Notes |
|------|-----------|-------|
| Home | `pages/Home.tsx` | Empty shell; timer lives in dock |
| Today | `pages/TaskBoard/TaskBoardPage.tsx` | Day columns, infinite scroll, drag schedule |
| Notes | `pages/Notes.tsx` | Sidebar + CodeMirror live-preview editor |
| Whiteboard | `pages/Whiteboard/WhiteboardPage.tsx` | Excalidraw, local IndexedDB only |
| Settings | `pages/Settings/index.tsx` | Theme, locale, pomodoro, Google Calendar, vault, sign out |

Overlays (not pages): `AnimatedStatsOverlay`, `AnimatedCalendarOverlay`, `PomodoroController`, `Palette` (Cmd+K).

## Env flags

| Variable | Default | Effect |
|----------|---------|--------|
| `VITE_HONE_LOCAL_ONLY` | `true` | Local-only: no cloud sync, no publish, no Google Calendar API |
| `VITE_HONE_LOCAL_API` | unset | Vite proxy to local services (8080/8089/8090/8091) |
| `VITE_HONE_DEV_LOGIN` | `true` in dev | Dev login panel (`POST /api/v1/auth/dev/login`) |
| `VITE_DRUZ9_API_BASE` | unset | Direct API base (skip proxy) |
| `VITE_DRUZ9_DEV_TOKEN` | unset | Bearer fallback for API calls |
| `VITE_DRUZ9_WEB_BASE` | unset | Public web URL for share links |
| `VITE_TELEGRAM_BOT_USERNAME` | `druz9_bot` | Fallback when `/v1/auth/config` fails |

Prod builds should set `VITE_HONE_LOCAL_ONLY=false` for cloud features.

## Backend dependencies

HTTP REST only (no gRPC in renderer). Prod base: `https://druz9.online` via Vite proxy.

| Service | Port (dev) | Used for |
|---------|------------|----------|
| identity | 8080 | Auth, healthz |
| tracker | 8089 | Work tasks, Google Calendar |
| notes | 8090 | Notes CRUD, vault, publish |
| focus | 8091 | Sessions, stats |
| rooms | 8087 | Whiteboard live share (when implemented) |

Billing is not called from Hone.

### HTTP endpoints (when sync enabled)

**identity**

| Method | Path | Client |
|--------|------|--------|
| GET | `/v1/auth/config` | `features/auth/api/auth.ts` |
| POST | `/v1/auth/telegram` | same |
| HEAD | `/healthz` | `SyncEngine.ts`, `OfflineBanner.tsx` |

**Tauri shell (Rust)** — `src-tauri/src/auth.rs` (native HTTP for login in packaged builds):

| Method | Path |
|--------|------|
| GET | `/v1/auth/config` |
| POST | `/v1/auth/telegram` |
| POST | `/api/v1/auth/telegram/start` (legacy, unused) |
| POST | `/api/v1/auth/telegram/poll` (legacy, unused) |

**tracker** — `features/tasks/repository/tasksRemote.ts`, `features/calendar/api/calendarClient.ts`

| Method | Path |
|--------|------|
| GET/POST | `/v1/tracker/work/tasks` |
| POST | `/v1/tracker/work/tasks/{id}/status` |
| DELETE | `/v1/tracker/work/tasks/{id}` |
| POST | `/v1/tracker/work/tasks/{id}/schedule` |
| POST | `/v1/tracker/work/tasks/{id}/unschedule` |
| GET/PATCH | `/v1/tracker/settings` |
| GET | `/v1/tracker/integrations/google/url` |
| POST | `/v1/tracker/integrations/google/disconnect` |
| GET | `/v1/tracker/integrations/google/events` |

**notes** — `features/notes/repository/notesRemote.ts`, `publishRemote.ts`, `vaultRemote.ts`, `shared/crypto/vault.ts`

| Method | Path |
|--------|------|
| GET/POST/PUT/DELETE | `/v1/notes`, `/v1/notes/{id}` |
| GET | `/v1/notes/{id}/publish-status` |
| POST | `/v1/notes/{id}/share-to-web` |
| POST | `/v1/notes/{id}/unpublish` |
| POST | `/v1/notes/{id}/make-private` |
| POST | `/v1/notes/vault/init` |
| GET | `/v1/notes/vault/salt` |
| POST | `/v1/notes/vault/notes/{noteId}/encrypt` |

**focus** — `features/focus/repository/focusRemote.ts`

| Method | Path |
|--------|------|
| GET | `/v1/focus/stats?up_to_date=` |
| POST | `/v1/focus/sessions/start` |
| POST | `/v1/focus/sessions/{id}/end` |

**rooms** (whiteboard sharing) — `features/whiteboard/api/whiteboardRemote.ts`

| Method | Path |
|--------|------|
| POST | `/v1/rooms/share-whiteboard` |
| POST | `/v1/rooms/publish-whiteboard` |

## IndexedDB schema

Database: `hone-db` v2. All entity stores use composite key `userId::id`.

| Store | Purpose |
|-------|---------|
| `notes` | Note bodies + metadata |
| `tasks` | Work task cards |
| `focus_sessions` | Local pomodoro sessions |
| `whiteboards` | Excalidraw scene JSON |
| `outbox` | Pending sync operations |
| `id_map` | Local UUID → server ID |
| `meta` | Sync cursors, prefs |

Scoped by `setDbUserId()` on sign-in.

## Sync engine

Enabled when: signed in **and** `LOCAL_ONLY === false`.

Engine: `shared/sync/SyncEngine.ts` — debounced 3s + 60s interval + online/focus triggers.

| Domain | Push ops | Pull | Backend |
|--------|----------|------|---------|
| notes | create, update, delete | full list + get each | notes CRUD + vault encrypt |
| tasks | create, status, schedule, unschedule, delete | full list | tracker work tasks |
| focus | session_start, session_end | none (stats on-demand) | focus sessions |

Conflict: LWW by `updatedAt`. Outbox: `shared/sync/outbox.ts`. ID map: `shared/sync/idMap.ts`.

Not synced: whiteboards (local + share/publish via rooms), vault prefs, Google Calendar reads, publish status (direct API on user action).

## Vault (E2EE)

Client: PBKDF2 200k + AES-256-GCM. Server stores salt + ciphertext only.

| File | Role |
|------|------|
| `shared/crypto/vault.ts` | Init, unlock, encrypt/decrypt |
| `shared/crypto/vaultPrefs.ts` | Local vault enabled flag |
| `shared/crypto/recoveryKey.ts` | Recovery phrase |
| `widgets/VaultUnlockGate.tsx` | Unlock UI (mount in App when vault enabled) |
| `pages/Settings/sections/VaultSection.tsx` | Settings |

Tauri IPC (OS keychain for passphrase):

| Command | Purpose |
|---------|---------|
| `vault_pass_load` | Load passphrase |
| `vault_pass_save` | Save passphrase |
| `vault_pass_clear` | Clear passphrase |

## Whiteboard

Local Excalidraw (`@excalidraw/excalidraw`). Single board `DEFAULT_BOARD_ID = 'default'` per user.

| File | Role |
|------|------|
| `features/whiteboard/repository/whiteboardStore.ts` | IndexedDB read/write |
| `pages/Whiteboard/WhiteboardPage.tsx` | UI + debounced save |
| `shared/lib/excalidraw/honeTheme.ts` | Theme sync |

Sharing (requires sign-in + network):

- **Live share** → `POST /v1/rooms/share-whiteboard` → web `/live/{roomId}?invite=...`
- **Publish** → `POST /v1/rooms/publish-whiteboard` → web `/board/{slug}` (read-only)

## Tauri IPC commands

Registered in `src-tauri/src/lib.rs`:

| Command | Purpose |
|---------|---------|
| `auth_session` | Load session from keychain |
| `auth_persist` | Save session + emit `auth:changed` |
| `auth_logout` | Clear session |
| `auth_tg_start` | Telegram login start (legacy poll flow) |
| `auth_tg_poll` | Telegram login poll (legacy) |
| `auth_config` | `GET /v1/auth/config` via native HTTP |
| `auth_telegram` | `POST /v1/auth/telegram` via native HTTP |
| `vault_pass_load/save/clear` | Vault passphrase keychain |
| `pomodoro_load/save` | Timer snapshot (Tauri store) |
| `shell_open_external` | Open URL in browser |
| `tray_update` | No-op stub |
| `window_traffic_lights_show` | macOS traffic lights |

Events: `app:deep-link`, `auth:changed`. Deep link schemes: `focus`, `task.open`, `note.open`.

## Commands

```bash
cd apps/hone
cp .env.example .env
npm install
npm run dev              # Tauri
npm run dev:vite         # browser-only (no IPC)
npm run typecheck
npm run test
npm run build            # Tauri release
```

Local backend: `VITE_HONE_LOCAL_API=true` + `make start` in each service.

## Release + updater

| Piece | Location |
|-------|----------|
| CI workflow | `.github/workflows/hone-release.yml` — trigger: tag `hone-v*` |
| Updater endpoint | GitHub Release `latest.json` (`plugins.updater.endpoints` in `tauri.conf.json`) |
| Settings UI | `pages/Settings/sections/SoftwareSection.tsx` |
| Updater helper | `shared/lib/updater.ts` — `@tauri-apps/plugin-updater` + `plugin-process` relaunch |

Release flow: bump `src-tauri/tauri.conf.json` version → tag `hone-vX.Y.Z` → push tag → CI uploads `.dmg`/`.msi`/`.exe` + signed updater artifacts.

Default macOS bundle uses ad-hoc signing (`signingIdentity: "-"` in `tauri.conf.json`) so CI works without Apple certs. Set repo variable `HONE_CODE_SIGNING=true` + Apple secrets for Developer ID + notarization (see `SIGNING.md`).

GitHub secret `TAURI_SIGNING_PRIVATE_KEY` must match `plugins.updater.pubkey`. Private key lives in `.tauri/hone.key` (gitignored).

## Known gaps

| Gap | Status |
|-----|--------|
| `VaultUnlockGate` | Implemented; mount when vault enabled |
| Note folders | Data model only; no folder UI |
| Task delete in UI | Remote + sync support exists; no TaskRow delete button |
| Google OAuth callback | Tracker redirects to web `/tasks`; Hone should handle deep link |

## Layout

```
apps/hone/
├── AGENTS.md
├── README.md
├── src-tauri/           # Rust: auth, vault, pomodoro, deep links
└── src/renderer/src/
    ├── app/             # bootstrap, App shell, features.ts
    ├── pages/           # Home, TaskBoard, Notes, Whiteboard, Settings
    ├── widgets/         # Dock, Palette, overlays, Login
    ├── features/        # auth, focus, notes, tasks, calendar, whiteboard
    ├── shared/          # db, sync, crypto, ui, model
    └── platform/        # Tauri IPC bridge
```
