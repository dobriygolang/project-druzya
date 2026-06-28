# Frontend migration — druzya/frontend → apps/web

> **Источник UI:** `/Users/sedorofeevd/Desktop/druzya/frontend` (legacy monolith API `/api/v1`)  
> **Целевой backend:** microservices в `services/*` (HTTP `/v1/*`, см. `deploy/Caddyfile`)  
> **Правило:** никаких fake/mock/localStorage как источника пользовательских данных.  
> Нет endpoint → карточка скрыта или `<FeatureUnavailable>`.

**Живой реестр:** `src/lib/migration/features.ts` (статусы + RPC).  
**Dev-дашборд:** `/migration` (только `import.meta.env.DEV`).

---

## Принципы

| Do | Don't |
|----|-------|
| Данные только с backend (`lib/api/*`) | MSW, hardcoded arrays, localStorage goals |
| Нет RPC → STUB / скрыть секцию | «Временные» моки «пока бэк не готов» |
| Одна страница за итерацию | Копировать весь frontend одним коммитом |
| Сохранять URL (redirect / stub) | Ломать закладки без причины |
| Обновлять `features.ts` + чеклист ниже | Держать статус «в голове» |

---

## Фаза 0 — инфраструктура

- [x] `MIGRATION.md` (этот файл)
- [x] `src/lib/migration/features.ts` — реестр маршрутов и RPC
- [x] `src/components/FeatureUnavailable.tsx`
- [x] `src/components/RequireFeature.tsx`
- [x] `src/pages/MigrationStatusPage.tsx` (dev)
- [x] `apiClient` → `/v1`, refresh, proto JSON normalize (`src/lib/apiClient.ts`)
- [x] Vite proxy → microservices (`vite.config.ts`)
- [x] `src/lib/api/*` — тонкий слой под новые proto/handlers
- [x] `.env.example` с `VITE_*`

**Не переносим в Phase 0:** весь `druzya/frontend` (~10k файлов). Копируем **страницу за страницей**.

---

## Фаза 1 — Auth (public)

| Route | Status | Backend RPC | Notes |
|-------|--------|-------------|-------|
| `/welcome` | `ready` | — | MVP page |
| `/login` | `ready` | `POST /v1/auth/telegram`, `GET /v1/auth/yandex/url` | Telegram code + Yandex |
| `/auth/callback` | `ready` | `POST /v1/auth/yandex/exchange` | Server redirect → exchange |
| `/legal/terms`, `/legal/privacy` | `ready` | — | MVP static pages |

**Legacy diff:** old frontend использует `POST /auth/telegram/poll`, `POST /auth/yandex/start`, callback `/auth/callback/yandex`.  
Новый identity: single-shot telegram, `GET /v1/auth/yandex/url` + exchange. **Не портируем старые auth queries as-is.**

- [x] MVP auth flow работает
- [x] Legal pages (MVP draft)

---

## Фаза 2 — Profile

| Route | Status | Backend RPC |
|-------|--------|-------------|
| `/profile` | `ready` | `GET /v1/me` |
| `/profile/:username` | `absent` | public profile — **нет в identity** |
| `/profile/settings` | `absent` | settings service — **нет** |
| `/profile/weekly` | `absent` | weekly report — **нет** |
| `/profile/memory` | `absent` | intelligence — **нет** |

- [x] `/profile` — username, avatar, billing from backend
- [x] Nav gated by `features.ts` (PRIMARY_NAV / MOBILE_NAV)

---

## Фаза 3 — Mock / Interview

| Route | Status | Backend RPC |
|-------|--------|-------------|
| `/mock` | `ready` | `GET /v1/companies`, `GET /v1/interview-templates`, `POST /v1/interview/sessions` |
| `/interview/session/:id` | `ready` | `GET …/current`, `POST …/attempts`, sandbox |
| `/interview/session/:id/results` | `ready` | `GET …/results` |
| `/mock/pipeline/:id` | `stub` | multi-stage pipeline — **не мигрирован** |
| `/mock/:sessionId` (legacy URL) | `absent` | redirect → new shape or stub |
| `/mock/replay/:attemptId` | `absent` | replay API — **нет** |

- [x] Company picker + template picker + start session
- [x] Solo training modes (one section per session)
- [x] Session UI: section timeline + live_coding task type
- [x] Removed localStorage sections / fake multi-select pipeline
- [x] Session results: polling, task titles, dashboard CTA, legacy URL redirects

---

## Фаза 4 — Live collab room

| Route | Status | Backend RPC |
|-------|--------|-------------|
| `/live/:roomId` | `ready` | `GET/POST /v1/rooms/*`, `WS /ws/editor/{id}` |

- [x] CollabRoomPage + Yjs
- [ ] Legacy `/editor/:id`, `/whiteboard/:id` — **rooms API другой контракт**

---

## Фаза 5 — Billing / checkout

| Route | Status | Backend RPC |
|-------|--------|-------------|
| `/pricing` | `partial` | `GET /v1/billing/me` (authed usage); catalog = migration seeds |
| `/checkout/*` | `absent` | Stripe/Tribute checkout UI — **нет** |
| `/billing/welcome` | `absent` | post-checkout |

- [x] `planCatalog.ts` — зеркало `00002_entitlements.sql`
- [x] PricingPage — catalog + live limits when logged in
- [x] Welcome pricing section uses shared catalog
- [x] Profile — billing limits from `/v1/billing/me` only
- [ ] Checkout flow (Tribute UI)

---

## Фаза 6 — Today (slim)

| Route | Status | Backend RPC |
|-------|--------|-------------|
| `/today` | `ready` | `GET /v1/recommendations/dashboard`, `GET /v1/me`, retry-items, learning-plan actions |

**Показываем только то, что есть на backend.** Legacy cards без RPC удалены (не STUB):

| Card (legacy) | Backend | Action |
|---------------|---------|--------|
| Readiness / recommendations | `recommendations/dashboard` | ✅ |
| Learning plan | `recommendations/learning-plan/*` | ✅ |
| Retry mistakes | `interview/retry-items` | ✅ |
| Goal wizard, daily plan, activity, streak | — | **removed** (localStorage) |
| Atlas weak spots | weaknesses on dashboard | ✅ via TodayActionGrid |

- [x] Strip `lib/today/*` localStorage usage
- [x] Backend-only Today page
- [ ] Port legacy Today **layout/shell** when AppShell migration starts

---

## Фаза 7+ — Backlog (backend отсутствует)

Статус `stub` до появления service. Маршрут можно зарегистрировать с `<RequireFeature>`.

| Area | Routes | Blocked by |
|------|--------|------------|
| Atlas / tracks | `/atlas`, `/atlas/explore`, `/atlas/track/:slug` | content/tracks service |
| Insights | `/insights` | intelligence |
| Task board | `/tasks` | — |
| Codex | `/codex` | — |
| Lingua | `/lingua/*` | — |
| Tutor | `/tutor/*`, `/tutors/discover` | — |
| Circles | `/circles/*` | — |
| Podcasts | `/podcasts` | — |
| Notifications | `/notifications` | — |
| Admin | `/admin/*` | — |
| Onboarding | `/onboarding` | primary track API |
| AI tutor chat | `/tutor/ai/:slug` | ai service (eval only today) |
| Weekly report | `/profile/weekly` | — |
| Status page | `/status` | observability |

---

## Как переносить одну страницу (runbook)

1. **Проверить RPC** — proto в `services/<name>/api/`, Caddy route в `deploy/Caddyfile`.
2. **Обновить `features.ts`** — `status: 'in_progress'`.
3. **Скопировать UI** из `druzya/frontend/src/pages/...` + нужные components.
4. **Заменить queries** — новые функции в `src/lib/api/<service>.ts`, не legacy `lib/queries/*`.
5. **Вырезать** секции без backend (не заменять моками).
6. **Typecheck + manual test** против локальных services (`make start` per service).
7. **Обновить** чеклист здесь + `features.ts` → `ready` | `partial` | `stub`.
8. **Nav** — показывать пункт меню только если `status === 'ready' | 'partial'`.

---

## Сохраняем из текущего apps/web (не переписывать)

```
src/lib/apiClient.ts
src/lib/protoJson.ts
src/lib/api/auth.ts
src/lib/api/content.ts
src/lib/api/interview.ts
src/lib/api/recommendation.ts
src/lib/api/billing.ts
src/lib/api/sandbox.ts
src/lib/api/rooms.ts
src/lib/api/normalize.ts
src/pages/CollabRoomPage.tsx
src/pages/SessionPage.tsx
src/pages/SessionResultsPage.tsx
vite.config.ts (proxy block)
```

---

## Local dev

```bash
# Backend (example — each service in its folder)
cd services/identity && make start
cd services/content && make start
# … interview, recommendation, billing, sandbox, rooms

cd apps/web
npm install
npm run dev   # :5173, proxies /v1 → localhost ports
```

`VITE_API_BASE=/v1` (default). Production: same-origin `/v1` via Caddy.

---

## Changelog

| Date | Phase | Done |
|------|-------|------|
| 2026-06-28 | 0 | Migration doc, features registry, FeatureUnavailable, dev /migration |
| 2026-06-28 | 6 | Today slim: removed localStorage cards, backend-only dashboard |
| 2026-06-28 | 5 | Pricing page, plan catalog, profile billing cleanup |
| 2026-06-28 | 3 | Mock hub: template picker, nav registry, no localStorage |
| 2026-06-28 | 1/3 | Legal pages, SessionPage sections progress |
| 2026-06-28 | 3 | SessionResults polish, legacy /mock/:id redirects |
