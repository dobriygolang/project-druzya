# Hone — desktop focus workspace

Winter-like desktop app: focus timer, notes, task board, whiteboard, stats overlay, settings.

**Agent docs:** [AGENTS.md](./AGENTS.md) — features, env, sync, API map, Tauri IPC.

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

## Release (macOS + Windows + in-app updates)

CI: [`.github/workflows/hone-release.yml`](../../.github/workflows/hone-release.yml)

1. Bump `version` in `src-tauri/tauri.conf.json` and `package.json`.
2. Commit, then tag: `git tag hone-v0.0.2 && git push origin hone-v0.0.2`
3. GitHub Actions builds **macOS** (Apple Silicon + Intel) and **Windows**, uploads installers + `latest.json` to the release.
4. Installed apps check **Settings → Software → Check for Updates** (Tauri updater → GitHub Releases).

**One-time setup (repo maintainer):**

- **Code signing (Gatekeeper / SmartScreen):** full guide → [`SIGNING.md`](./SIGNING.md)
- **Updater signing:** generate keys with  
  `CI=true npx tauri signer generate -w .tauri/hone.key -f -p ""` (from `apps/hone`)
- GitHub secret `TAURI_SIGNING_PRIVATE_KEY` = contents of `.tauri/hone.key`
- Optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key is password-protected
- Public updater key is in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`)

**Tag rule:** tag must match app version — `hone-v` + semver from `tauri.conf.json` (e.g. `hone-v0.0.1`).

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
