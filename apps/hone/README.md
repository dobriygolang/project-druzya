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

### 2. Бэкенд (минимум для Today / Notes / Schedule / Stats)

В **отдельных терминалах** из корня monorepo:

```bash
cd services/identity && make gen-jwt-keys && make start   # :8080
cd services/tracker  && make start                        # :8089
cd services/notes    && make start                        # :8090
cd services/focus    && make start                        # :8091
```

Проверка: `curl -s http://localhost:8080/healthz` и `http://localhost:8089/healthz`.

**Альтернатива без локального бэка:** в `.env` задать prod API:

```bash
VITE_DRUZ9_API_BASE=https://druz9.online
```

(нужен реальный аккаунт / токен).

### 3. Desktop-приложение

```bash
cd apps/hone
npm install --registry https://registry.npmjs.org   # если корп. registry ломает install
npm run dev                                         # окно Tauri + Vite :5173
```

В dev запросы идут **через Vite proxy** (`vite.config.ts`) на сервисы выше — отдельный gateway не нужен.

### 4. Вход

- **Tauri:** кнопка Telegram в приложении (нужен бот + `make run-bot` в identity, если настраиваете с нуля).
- **Dev login:** если на identity включён `DEV_AUTH=true` — кнопка в UI.
- **Только браузер** (`npm run dev:vite`): задайте `VITE_DRUZ9_DEV_TOKEN=<jwt>` в `.env`.

### 5. Сборка релиза

```bash
cd apps/hone
npm run build    # .dmg / .app в src-tauri/target/release/bundle/
```

---

## Dev scripts

| Команда | Описание |
|---------|----------|
| `npm run dev` | Tauri + hot reload |
| `npm run dev:vite` | только React в браузере (без native bridge) |
| `npm run typecheck` | TypeScript |
| `npm run build` | production bundle |

## Env (optional)

| Variable | Default dev | Описание |
|----------|-------------|----------|
| `VITE_DRUZ9_API_BASE` | *(пусто → proxy)* | Явный API URL |
| `VITE_DRUZ9_DEV_TOKEN` | — | Bearer для browser-only |
| `HONE_API_BASE` | `http://localhost:8080` | Rust-side Telegram auth |

## MVP pages

| Page | Status |
|------|--------|
| **Focus** | Pomodoro + stopwatch → `focus` |
| **Today** | Vertical task list → `tracker` |
| **Notes** | Sidebar + markdown → `notes` |
| **Schedule** | Day timeline + backlog → `tracker` |
| **Stats** | KPIs + heatmap → `focus` |

## Rust shell

`src-tauri/` — keychain auth, `druz9://` deep links, pomodoro store, macOS Focus shortcuts.
