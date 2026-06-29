# AGENTS.md — billing service

Work from this directory only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/billing`

## Purpose

**Entitlements, quotas, subscriptions.** Product services call billing before expensive work.

Owns: plans, entitlements, subscriptions, usage counters, Tribute webhooks.

Does not own: users (identity), tasks (tracker), notes (notes service).

## Entitlements

`value_json`: `{"type":"bool","value":true}` or `{"type":"counter","limit":N,"period":"day"|"month"}` or `{"type":"gauge","limit":N}`.

Seeded in `00001_init.sql` + `00002_productivity_entitlements.sql`: `free`, `pro_monthly`.

| Key | Free | Pro |
|-----|------|-----|
| cloud_notes_count | 10 | unlimited |
| ai_insights_per_day | 5 | 50 |
| live_rooms_per_month | 5 | 30 |
| live_rooms_concurrent | 1 | 5 |
| code_runs_per_day | 50 | 500 |
| ai_evaluations_per_day | 25 | 100 (ai service, CI only) |
| mock_interviews_per_month | 3 | 30 (legacy seed) |

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetMe | `GET /v1/billing/me` | JWT |
| GetEntitlements, CheckEntitlement, CheckAndConsumeUsage, ReleaseUsage | gRPC | `x-internal-token` |
| Grant/Revoke subscription | admin HTTP | `x-internal-token` |
| Tribute webhook | `POST /v1/billing/webhooks/tribute` | `trbt-signature` HMAC-SHA256 hex (API key) |

Consumers: **rooms** (live rooms/month + concurrent), **sandbox** (runs/day, hidden tests), **notes** (cloud_notes_count, future), **ai** (eval/day, CI only).

## Invariants

- Atomic consume (`INSERT … ON CONFLICT … WHERE used+amount<=limit`)
- Webhook + subscription changes in one tx; duplicate webhooks idempotent
- One active subscription per user (partial unique index)
- `ReleaseUsage` idempotent via `usage_release_dedup`

## Caches

Plans snapshot in RAM at startup. Optional Redis entitlements cache (`ENTITLEMENTS_CACHE_TTL`, 60s).

## Ports

HTTP `8085` | gRPC `9095` | PG `5438` / `druzya_billing`

## Commands

```bash
cd services/billing
make start | gen-proto | lint | test | build
```

Production requires `INTERNAL_API_TOKEN`, `TRIBUTE_WEBHOOK_SECRET`.
