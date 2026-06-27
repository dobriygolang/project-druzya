# AGENTS.md — billing service

**Self-contained service.** Work from this directory only.

Monorepo index: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/billing`

## Purpose

Central **entitlements, quotas and subscriptions** service. Product services stay
thin by calling billing before expensive work instead of duplicating limit logic.

Owns:

- **Plans** + **plan entitlements** (boolean feature gates and counter quotas)
- **Subscriptions** (internal grants + external provider subscriptions)
- **Usage counters** (per user, per entitlement key, per period window)
- **Provider accounts / events** (Tribute webhook ingestion, deduped)

Does **not** own: users/auth (identity), tasks (content), attempts (interview),
AI scoring (ai). It only resolves Telegram → user via the identity gRPC client.

## Entitlement model

`plan_entitlements.value_json` is one of:

- `{"type":"bool","value":true}` — feature gate
- `{"type":"counter","limit":100,"period":"day"|"month"}` — quota (omit `limit` for unlimited)

Seeded plans (`scripts/migrations/00002_entitlements.sql`): `free`, `pro_monthly`.

## API

| Service | RPC | HTTP | Auth |
|---------|-----|------|------|
| `BillingService` | `GetMe` | `GET /v1/billing/me` | JWT |
| `BillingInternalService` | `GetEntitlements` | — | `x-internal-token` |
| | `CheckEntitlement` (bool only) | — | `x-internal-token` |
| | `CheckAndConsumeUsage` (counters) | — | `x-internal-token` |
| `BillingAdminService` | `GrantSubscription` | `POST /v1/billing/admin/subscriptions/grant` | `x-internal-token` |
| | `RevokeSubscription` | `POST /v1/billing/admin/subscriptions/revoke` | `x-internal-token` |
| custom HTTP | Tribute webhook | `POST /v1/billing/webhooks/tribute` | shared secret header |

Consumers: **ai** (`ai_evaluations_per_day`), **interview** (`mock_interviews_per_month`,
`company_templates_enabled`), **sandbox** (`code_runs_per_day`, `hidden_tests_enabled`).

## Correctness invariants

- **Usage consumption is atomic** — `ConsumeUsage` is a single
  `INSERT ... ON CONFLICT ... WHERE used+amount<=limit RETURNING` (no first-insert race).
- **Webhook is transactional** — `MarkProviderEventProcessed` and the subscription
  change run in one `WithTx`; failure rolls back the dedup row so retries work.
  Duplicate deliveries return HTTP 200 (idempotent).
- **Grant/revoke are transactional** — cancel previous + upsert new in one tx.
- **One active subscription per user** — enforced by partial unique index
  (`00003_one_active_subscription.sql`).
- **Expired subscriptions are ignored** — `GetActiveSubscription` filters
  `current_period_end > now()`.
- In `production`, `INTERNAL_API_TOKEN` and `TRIBUTE_WEBHOOK_SECRET` are required.

## Layout

```
cmd/billing/app/run.go              — DI
internal/app/api/billing/           — transport, one RPC per file
internal/billing/
  model/                            — plans, subscriptions, entitlements, views
  entitlement/                      — value_json parsing, period windows
  repository/                       — Store port + Postgres (WithTx)
  service/                          — Service interface + orchestration
internal/adapter/
  identity/                         — identity gRPC client
  providers/tribute/                — webhook verify + parse
  events/                           — Publisher (Noop until a bus exists)
internal/config/  internal/tools/
scripts/migrations/  scripts/dev/docker-compose.yml
```

## Ports

| Protocol | Value |
|----------|-------|
| HTTP | 8085 |
| gRPC | 9095 |
| Postgres | 5438 / `druzya_billing` |

## Commands

```bash
cd services/billing
make start
make gen-proto
make lint
make test
make build
```
