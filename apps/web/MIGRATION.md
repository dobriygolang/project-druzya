# Frontend migration — legacy → apps/web

**Registry:** `src/lib/migration/features.ts`  
**Dev dashboard:** `/migration` (DEV only)

Backend: microservices `/v1/*`. No mocks/localStorage for user data. Missing RPC → hide or `<FeatureUnavailable>`.

## Principles

- One page per iteration
- Data from `lib/api/*` only
- Update `features.ts` when status changes

## Phase status

| Phase | Routes | Status |
|-------|--------|--------|
| 0 Infra | apiClient, proxy, features registry | done |
| 1 Auth | `/login`, `/welcome`, `/auth/callback`, `/legal/*` | ready |
| 2 Profile | `/profile` | ready; settings/weekly/memory absent |
| 3 Mock | `/mock`, `/interview/session/:id`, results | ready; pipeline/replay absent |
| 4 Live | `/live/:roomId` | ready |
| 5 Billing | `/pricing` | partial; checkout absent |
| 6 Today | `/today` | ready (backend-only) |
| 7+ Backlog | atlas, tutor, circles, … | stub — no backend |

## Per-page workflow

1. Check proto + Caddy route
2. Update `features.ts`
3. Port UI from legacy frontend
4. Wire `lib/api/<service>.ts`
5. Mark `ready` / `partial` / `stub` in registry

## Local dev

```bash
cd services/identity && make start
# + content, interview, recommendation, billing, sandbox, rooms as needed
cd apps/web && npm install && npm run dev
```

Legacy auth API differs (poll/start) — use identity `/v1/auth/*` only.
