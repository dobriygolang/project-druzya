# project-druzya

Monorepo of **independent microservices**. Each service is self-contained — open its folder and read local `AGENTS.md`.

## Services


| Service  | Path                                     | Prod               |
| -------- | ---------------------------------------- | ------------------ |
| identity | [services/identity/](services/identity/) | yes                |
| billing  | [services/billing/](services/billing/)   | yes                |
| sandbox  | [services/sandbox/](services/sandbox/)   | yes                |
| rooms    | [services/rooms/](services/rooms/)       | yes                |
| tracker  | [services/tracker/](services/tracker/)   | yes                |
| notes    | [services/notes/](services/notes/)       | yes                |
| focus    | [services/focus/](services/focus/)       | yes                |
| ai       | [services/ai/](services/ai/)             | CI only (post-MVP) |
| template | [services/template/](services/template/) | skeleton only      |


Ports and DB names: [AGENTS.md](AGENTS.md#port-allocation-defaults).

## Docs


| Doc                                                              | For                                 |
| ---------------------------------------------------------------- | ----------------------------------- |
| [AGENTS.md](AGENTS.md)                                           | Monorepo index, service template    |
| [docs/onboarding/](docs/onboarding/)                             | Architecture diagrams + service map |
| [apps/web/MIGRATION.md](apps/web/MIGRATION.md)                   | Frontend port status                |
| [deploy/PRODUCTION_CHECKLIST.md](deploy/PRODUCTION_CHECKLIST.md) | First prod deploy                   |
| [deploy/RUNBOOK.md](deploy/RUNBOOK.md)                           | Ops, incidents, LLM tuning          |




## Local dev

```bash
cd services/identity && make start   # JWT keys + Postgres + Redis
cd apps/web && npm install && npm run dev   # :5173, proxies /v1
```



## Production

Canonical site: **[https://druz9.online](https://druz9.online)** — API `api.druz9.online`; `druz9.ru` → `.online`.

```bash
cd deploy && cp .env.example .env && make keys && make up
```

Root `go.work` is optional. Services build with `GOWORK=off`.

Что работает

REST-клиент tracker (list/create/move/delete/kind)

Kanban: To Do → In Progress → In Review → Done. Сомнительно, мы же не так планировали. Хотели бесконечный список задач, фото приложил.

Drag-and-drop между колонками 

Создание задачи (модалка)

Drawer с деталями задачи

Archive (dismissed → restore/delete)

Фильтры: All / This week + kind chips

Локальный rename title (localStorage)

Что пока не переносили (на потом)

SSE / AI cursor - не уверен, что это понадобится

Bulk auto-tag 

KindPicker popup (клик по kind — циклическая смена)

i18n (английские строки) - надо делать поддержку ru/en

TodayGoalSection

### **Что добавлено**

- `focusClient` — `start` / `end` / `getStats` → `/v1/focus/*`
- `useFocusSession` — таймер, persist в Rust store, tray title, macOS Focus shortcut
- **FocusDock** — pomodoro ↔ stopwatch, play/pause, reset (над nav)
- **Home** — idle state, pinned task, corner timer, Stop, reflection после pomodoro
- **Settings** — длина pomodoro (5–90 мин), имя macOS Shortcuts
- **Deep link** — `druz9://focus.start?task=…&title=…`



### **Как проверить**

cd apps/hone && npm run dev

Focus → ▶ → таймер идёт → по нулю reflection prompt. Нужны `identity` + `focus` на `:8080`.

### **Пока без**

- ambient music, resistance modal, offline outbox для reflection
- plan/free/pinned modes (только pomodoro + stopwatch)

**Фича 3/6: Notes** — готова.

### **Что работает**

- `notesClient` — list/get/create/update/delete, folders, move
- **UI** — sidebar со списком, resizable panel, markdown textarea
- **Autosave** — debounce 400ms + flush on blur
- **Folders** — фильтр + создание новой папки
- **Deep link** — `druz9://note.open?id=…` открывает заметку
- **Billing** — понятное сообщение при лимите cloud notes (429)



### **Пока без (можно добавить позже)**

- E2EE vault
- Local notes / sync offline
- Publish to web
- CodeMirror / RichMarkdownEditor
- Drag-and-drop folder tree, quota bar



### **Что работает**

- **Backlog** — незапланированные задачи из Today (drag)
- **Timeline** 06:00–23:00 — drop в слот → `scheduleTask` (60 мин по умолчанию, при переносе сохраняется длительность)
- **Блоки** — drag на другой слот, resize снизу (шаг 15 мин), unschedule (×)
- **Навигация** — prev / today / next + сумма «X.Xh scheduled»
- **Now-line** — красная линия текущего времени (только сегодня)



### **Проверка**

Schedule → перетащи задачу из backlog на timeline. Нужен `tracker` + задачи в Today.

### **Пока без**

- Google Calendar sync UI (это в Settings tracker, можно позже)
- 15-min grid lines (только half-hour snap при drop)



### **Что работает**

- `GET /v1/focus/stats` — загрузка через `getStats()`
- **KPI-карточки** — focus today, streak (current + longest), total minutes
- **Heatmap** — последние 7 дней (бары по минутам)
- **Range picker** 7d / 30d / 90d — пока в hint (как в legacy; API не фильтрует по range)
- `padToSevenDays` — добавлен в `focusClient`

