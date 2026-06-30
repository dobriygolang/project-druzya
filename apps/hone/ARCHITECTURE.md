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

**In:** Telegram/dev login, pomodoro timer + focus sessions API, cloud notes editor, kanban tasks, stats page, theme + pomodoro settings.

**Out (removed for now):** vault E2EE, publish-to-web, local-only notes, offline sync cache, stats overlay, macOS Focus shortcuts, 6 timer modes, reflection prompt, billing/upgrade UI.

## Rust shell (`src-tauri/`)

Auth keychain, deep links, pomodoro snapshot, tray title. Legacy vault/focus/updater commands may remain in Rust but are not wired from the UI.

## Dev

```bash
cd apps/hone && npm run dev
```

Build check: `npm run build:vite`
