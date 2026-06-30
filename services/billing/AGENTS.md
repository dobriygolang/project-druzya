# AGENTS.md — billing service

Work from this directory only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/billing`

## Purpose

**Entitlements, quotas, subscriptions.** Product services call billing before expensive work.

Owns: plans, entitlements, subscriptions, usage counters, Tribute webhooks.

Does not own: users (identity), tasks (tracker), notes (notes service).

## Entitlements

`value_json`: `{"type":"bool","value":true}` or `{"type":"counter","limit":N,"period":"day"|"month"}` or `{"type":"gauge","limit":N}`.

Seeded in `00001_init.sql`. Plans: `free`, `pro_monthly`.

| Key | Type | Free | Pro |
|-----|------|------|-----|
| cloud_notes_count | gauge | unlimited | unlimited |
| live_rooms_per_month | counter/month | unlimited | 30 |
| live_rooms_concurrent | gauge | unlimited | 5 |
| code_runs_per_day | counter/day | unlimited | 500 |

**Not seeded** (retired with interview/content/recommendation): `mock_interviews_per_month`, `ai_evaluations_per_day`, `ai_insights_per_day`, `company_templates_enabled`, `recommendations_enabled`, `advanced_feedback_enabled`, `sd_ai_turns_per_month`, `hidden_tests_enabled`.

## API

| RPC | HTTP | Auth |
|-----|------|------|
| GetMe | `GET /v1/billing/me` | JWT |
| GetEntitlements, CheckEntitlement, CheckAndConsumeUsage, ReleaseUsage | gRPC | `x-internal-token` |
| Grant/Revoke subscription | admin HTTP | `x-internal-token` |
| Tribute webhook | `POST /v1/billing/webhooks/tribute` | `trbt-signature` HMAC-SHA256 hex (API key) |

Consumers: **rooms** (live rooms/month + concurrent), **sandbox** (code_runs_per_day), **notes** (cloud_notes_count).

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
