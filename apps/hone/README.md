# Hone — desktop focus workspace

Winter-like desktop app: focus timer, notes, task board, stats, settings.

**Architecture map:** [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, imports, what to delete.

Tauri + React (`src/renderer/`). Native shell: `src-tauri/`.

## Dev

```bash
cd apps/hone
cp .env.example .env   # first time
npm install
npm run dev              # Tauri
# npm run dev:vite       # browser-only (no shell IPC)
```

**Default:** Vite proxies `/v1/*` to prod (`https://druz9.online`). Login: Telegram code flow (same as web).

**Local backend:** set `VITE_HONE_LOCAL_API=true` in `.env` and run services (`make start` per service).

## Build

```bash
npm run build            # Tauri release
npm run build:vite
npm run typecheck
npm run test
```

## Layout

```
apps/hone/
├── ARCHITECTURE.md       # layer map + delete guide
├── src-tauri/            # Rust native shell
└── src/renderer/src/
    ├── app/              # bootstrap + App shell
    ├── pages/            # screens
    ├── widgets/          # Dock, Palette, Login, …
    ├── features/         # domain API (auth, focus, notes, tasks)
    ├── shared/           # ui, hooks, model, transport
    └── platform/         # Tauri IPC bridge
```

Backend: project-druzya services (`identity`, `tracker`, `notes`, `focus`, `billing`).
