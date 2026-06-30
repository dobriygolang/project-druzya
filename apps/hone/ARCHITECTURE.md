# Hone — MVP architecture

Tauri desktop app: login, home + pomodoro dock, notes, task board, stats, settings.

## Layers

| Alias | Folder | Role |
|-------|--------|------|
| `@app` | `app/` | bootstrap, App shell, styles |
| `@pages` | `pages/` | Home, Notes, TaskBoard, Stats, Settings |
| `@widgets` | `widgets/` | Dock, Palette, Login, OfflineBanner, Chrome |
| `@features` | `features/` | auth, focus, notes, tasks API |
| `@shared` | `shared/` | config, device, hooks, model, ui |
| `@platform` | `platform/` | ipc types, native-bridge |

## MVP scope

**In:** Telegram/dev login, pomodoro timer + focus sessions API, cloud notes editor, **day-column task board + day timeline** (Winter-style), stats page, theme + pomodoro settings.

**Out (removed for now):** vault E2EE, kanban columns/kinds/archive, publish-to-web, local-only notes, offline sync cache, stats overlay, macOS Focus shortcuts, 6 timer modes, reflection prompt, billing/upgrade UI.

## Task board (Winter direction)

- **Left:** horizontal scroll of day columns (−14…+21 days), inline «Add task», checkbox + delete.
- **Right:** fixed timeline for the selected day (`scheduledStart` / `scheduledDurationMin` from tracker).
- **Next:** true infinite scroll (prepend/append), drag-to-schedule on timeline, link to pomodoro pin.

## Rust shell (`src-tauri/`)

Auth keychain, deep links, pomodoro snapshot, tray title.

## Dev

```bash
cd apps/hone && npm run dev
```

Build check: `npm run build:vite`
