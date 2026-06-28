# Onboarding — архитектура project-druzya

Материалы для нового сотрудника: что за сервисы, кто кому шлёт данные, что хранится в БД.

## Как открыть диаграммы

1. Установите расширение **Excalidraw** в Cursor (если ещё нет).
2. **Закройте** файл, если он открыт как JSON-текст (1339+ строк).
3. Правый клик на `.excalidraw` → **Open With…** → **Excalidraw Editor**.
4. Первое открытие после старта Cursor может занять 5–15 сек (webview). Это норма для плагина.
5. Если крутится бесконечно — `Cmd+Shift+P` → **Developer: Reload Window**.

> Файлы хранятся в **compact JSON** (1 строка) — так быстрее парсится, чем pretty-print на 1000+ строк.

| # | Файл | Содержание |
|---|------|------------|
| **0** | **[00-master-architecture.excalidraw](./00-master-architecture.excalidraw)** | **Главная схема** (формат референса): User → Caddy → сервисы с API, Redis, externals, PG-схемы |
| 1 | [01-overview.excalidraw](./01-overview.excalidraw) | Краткий обзор |
| 2 | [02-services-and-data.excalidraw](./02-services-and-data.excalidraw) | Каждый сервис: зона ответственности, таблицы/Redis, что отдаёт и кто потребляет |
| 3 | [03-sync-communication.excalidraw](./03-sync-communication.excalidraw) | HTTP (user), gRPC (s2s), WebSocket; маршруты Caddy |
| 4 | [04-async-flows.excalidraw](./04-async-flows.excalidraw) | Outbox: SubmitAttempt → ai → recommendation |
| 5 | [05-user-journeys.excalidraw](./05-user-journeys.excalidraw) | Логин, mock interview, live room, подписка |

## Быстрый старт (5 минут)

**Платформа** — подготовка к техническим интервью (mock interviews, live coding, рекомендации по навыкам).

```
Browser (apps/web)
    │  HTTPS /v1/*, /ws/*
    ▼
Caddy (prod) / Vite proxy (dev)
    │
    ├── identity      — auth, JWT, профили
    ├── content       — каталог (задачи, рубрики, шаблоны)
    ├── interview     — сессии, попытки, outbox
    ├── ai            — LLM-оценка (worker)
    ├── recommendation— скиллы, рекомендации
    ├── billing       — квоты, подписки
    ├── sandbox       — запуск кода + gopls
    └── rooms         — live collab (Yjs WS)
```

**Главное правило:** у каждого сервиса своя Postgres-база. Чужие данные — только через gRPC (`internal/adapter/`).

## Карта сервисов

| Сервис | HTTP | gRPC | БД | Одной фразой |
|--------|------|------|-----|--------------|
| identity | 8080 | 9090 | PG + Redis | Кто пользователь, JWT |
| content | 8081 | 9091 | druzya_content | Что можно решать |
| interview | 8082 | 9092 | druzya_interview | Что пользователь решает сейчас |
| ai | 8083 | 9093 | druzya_ai | Как оценить ответ |
| recommendation | 8084 | 9094 | druzya_recommendation | Что учить дальше |
| billing | 8085 | 9095 | druzya_billing | Лимиты и тариф |
| sandbox | 8086 | 9096 | druzya_sandbox | Запуск кода |
| rooms | 8087 | 9097 | druzya_rooms | Совместный редактор |

Подробности — в `services/<name>/AGENTS.md` каждого сервиса.

## Кто кому звонит (gRPC)

| От | К | Зачем |
|----|---|-------|
| interview | content | шаблон интервью, задача |
| interview | billing | лимит mock-интервью |
| ai | interview | outbox, attempt, CompleteEvaluation |
| ai | content | task + rubric bundle |
| ai | billing | лимит LLM-оценок |
| recommendation | interview | outbox, eval summary |
| recommendation | content | метаданные задачи |
| sandbox | content | тесты из metadata |
| sandbox | interview | SubmitAttempt |
| sandbox | billing | лимит запусков кода |
| rooms | identity | scoped JWT для гостей |
| rooms | billing | лимит комнат |
| billing | identity | telegram → user_id |

## Асинхронные события (outbox в interview)

| Событие | Producer | Consumer | Когда |
|---------|----------|----------|-------|
| `attempt_submitted` | interview | ai | пользователь отправил ответ |
| `attempt_evaluated` | interview | recommendation | ai вернул оценку |
| `session_completed` | interview | recommendation | сессия полностью оценена |
| `retry_item_created` | interview | recommendation | задача ушла в retry |

## Что храним (кратко)

| Сервис | Ключевые сущности |
|--------|-------------------|
| identity | users; Redis: refresh, login codes, oauth state |
| content | companies, templates, tasks, rubrics, solutions |
| interview | sessions, attempts, evaluation_summaries, retry_items, **domain_outbox** |
| ai | evaluation_jobs, model_calls |
| recommendation | skill_scores, recommendations, learning_plan_items |
| billing | plans, subscriptions, usage_counters |
| sandbox | code_runs (code, stdout, test results) |
| rooms | code_rooms, participants (не текст редактора — Yjs in-memory) |

## Локальная разработка

```bash
# 1. Identity (JWT keys + Postgres + Redis)
cd services/identity && make start

# 2. Остальные сервисы — по необходимости
cd services/content && make start
cd services/interview && make start
# …

# 3. Frontend
cd apps/web && npm install && npm run dev
# → http://localhost:5173
# Dev tracker: /migration
```

Prod: [deploy/RUNBOOK.md](../../deploy/RUNBOOK.md), [deploy/Caddyfile](../../deploy/Caddyfile).

## Чеклист первой недели

- [ ] Прочитать все 5 Excalidraw-диаграмм
- [ ] Прочитать [AGENTS.md](../../AGENTS.md) (monorepo index)
- [ ] Запустить identity + content + interview + apps/web локально
- [ ] Пройти flow: логин → старт сессии → sandbox run → submit attempt
- [ ] Открыть `services/interview/AGENTS.md` — понять outbox
- [ ] Прочитать [.cursor/rules/architecture-standard.mdc](../../.cursor/rules/architecture-standard.mdc) — слои кода

## Обновление диаграмм

Диаграммы генерируются скриптом (не правьте JSON руками, если не нужно):

```bash
cd docs/onboarding
python3 generate_excalidraw.py
```

После генерации можно доработать визуально в Excalidraw-плагине и сохранить.

## Источники правды

| Документ | Когда смотреть |
|----------|----------------|
| `services/*/AGENTS.md` | Домен, API, env конкретного сервиса |
| `deploy/Caddyfile` | Маршрутизация prod |
| `apps/web/MIGRATION.md` | Статус frontend-фич |
| `deploy/RUNBOOK.md` | Prod ops, restart order |
