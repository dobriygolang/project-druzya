# Hone (Tauri)

Winter-like focus workspace for macOS / Windows / Linux.

Fresh Tauri + React scaffold. Legacy Electron app: [`../hone-legacy/`](../hone-legacy/).

## Как запустить (локально)

### 1. Зависимости

| Что | Зачем |
|-----|--------|
| [Node.js](https://nodejs.org/) 20+ | фронт, `npm run dev` |
| [Rust](https://rustup.rs/) + Xcode CLT (macOS) | Tauri shell |
| Docker | Postgres для бэкенда |

Первый раз на macOS для Tauri:

```bash
xcode-select --install   # если ещё нет Command Line Tools
rustup update stable
```

### 2. API (по умолчанию — prod)

**`npm run dev` без `.env` ходит на `https://druz9.online`** — локальный identity/tracker не нужен.

Telegram-вход — как на вебе: бот `/start login` → код → `POST /v1/auth/telegram`.

**Локальный microservices stack** — только если явно включили в `apps/hone/.env`:

```bash
VITE_HONE_LOCAL_API=true
HONE_API_BASE=http://localhost:8080
```

Тогда поднимите сервисы в отдельных терминалах:

```bash
cd services/identity && make gen-jwt-keys && make start   # :8080
cd services/tracker  && make start                        # :8089
cd services/notes    && make start                        # :8090
cd services/focus    && make start                        # :8091
```

Фронт в этом режиме идёт через Vite proxy (`vite.config.ts`).

### 3. Desktop-приложение

```bash
cd apps/hone
npm install --registry https://registry.npmjs.org   # если корп. registry ломает install
npm run dev                                         # окно Tauri + Vite :5173
```

### 4. Вход

- **Tauri:** кнопка Telegram в приложении (нужен бот + `make run-bot` в identity, если настраиваете с нуля).
- **Dev login:** feature flag `VITE_HONE_DEV_LOGIN` (default **on** in `npm run dev`, **off** in `npm run build`). Backend: `DEV_AUTH=true` on identity. UI — subtle bar at the bottom of the login screen.
- **Только браузер** (`npm run dev:vite`): задайте `VITE_DRUZ9_DEV_TOKEN=<jwt>` в `.env`.

### 5. Сборка релиза

```bash
cd apps/hone
npm run build    # .dmg / .app в src-tauri/target/release/bundle/
```

---

## Icons

App icon = [`apps/web/public/favicon.svg`](../web/public/favicon.svg) (two circles on dark square).

- Browser tab: `public/favicon.svg`
- Tauri bundle: `src-tauri/icons/` — regenerate after changing the SVG:

```bash
npm run icon
```

## Dev scripts

| Команда | Описание |
|---------|----------|
| `npm run dev` | Tauri + hot reload |
| `npm run dev:vite` | только React в браузере (без native bridge) |
| `npm run typecheck` | TypeScript |
| `npm run build` | production bundle |

## Env (optional)

| Variable | Default | Описание |
|----------|---------|----------|
| `VITE_DRUZ9_API_BASE` | `https://druz9.online` | API для React (override) |
| `VITE_HONE_LOCAL_API` | off | `true` → Vite proxy на localhost |
| `VITE_DRUZ9_DEV_TOKEN` | — | Bearer для browser-only |
| `VITE_HONE_DEV_LOGIN` | on in dev / off in prod build | Dev login UI |
| `HONE_API_BASE` | `https://druz9.online` | Rust Telegram auth |

## MVP pages

| Page | Status |
|------|--------|
| **Focus** | Pomodoro + stopwatch → `focus` |
| **Today** | Day columns + timeline → `tracker` |
| **Notes** | Sidebar + markdown → `notes` |
| **Stats** | KPIs + heatmap → `focus` |

## Rust shell

`src-tauri/` — keychain auth, `druz9://` deep links, pomodoro store, macOS Focus shortcuts.
