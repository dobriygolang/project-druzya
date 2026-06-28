# Database migration cutover (squashed init baseline)

Per-service goose history was consolidated into forward-only `00001_init.sql` (+ content `00002_seed.sql`). This document covers deploy paths for **empty prod** vs **prod with user data**.

## When to use which path

| Situation | Action |
|-----------|--------|
| Fresh deploy / dev | `make reset-db` → `make migrate` → `make up` |
| Empty prod (no users) | Stop apps → `make reset-db` → migrate → `make up` (see [RUNBOOK.md](../RUNBOOK.md)) |
| Prod with users & data | **Cutover below** — do not run `reset-db` |

## Pre-cutover checklist

1. **Backup all databases:** `cd deploy && make backup`
2. Record goose versions per DB:
   ```bash
   for db in druzya druzya_content druzya_interview druzya_ai druzya_recommendation druzya_billing druzya_sandbox druzya_rooms; do
     echo "=== $db ==="
     docker compose -f docker-compose.prod.yml exec -T postgres \
       psql -U "$POSTGRES_USER" -d "$db" -c "SELECT version_id, is_applied FROM goose_db_version ORDER BY version_id;"
   done
   ```
3. Compare live schema to new `services/*/scripts/migrations/00001_init.sql` (especially billing entitlements, content articles).

## Cutover with data (manual)

Goose will **not** re-apply `00001_init` if older migrations are already recorded. Options:

### Option A — schema already matches (incremental history only)

If production schema matches the squashed init files (migrations were applied incrementally before squash):

1. Deploy new code (same schema, new migration files).
2. Run `make migrate` — goose sees version 1 applied, no-op.
3. **Billing entitlements:** if free `ai_evaluations_per_day` changed (e.g. 5 → 25), run targeted SQL or re-seed plans:
   ```sql
   -- example: update free plan entitlement in druzya_billing
   UPDATE plan_entitlements pe
   SET limit_value = 25
   FROM plans p
   WHERE pe.plan_id = p.id AND p.slug = 'free' AND pe.entitlement_key = 'ai_evaluations_per_day';
   ```

### Option B — schema drift (squash adds columns/tables prod lacks)

1. Stop app services (keep postgres running).
2. Generate diff: `pg_dump --schema-only` vs init SQL, or use `migrate diff` tooling.
3. Apply **forward-only** patch migration or manual `ALTER`/`CREATE` to align schema.
4. Optionally reset goose version table to reflect single baseline (advanced — only with DBA review):
   ```sql
   -- druzya_interview example — ONLY if schema matches 00001_init exactly
   TRUNCATE goose_db_version;
   INSERT INTO goose_db_version (version_id, is_applied) VALUES (1, true);
   ```
5. Restart stack and smoke-test core loop.

### Option C — acceptable downtime, data export/import

For small datasets:

1. `make backup`
2. `make reset-db` + migrate (empty baseline)
3. Restore **user-generated** rows only (identity users, sessions, attempts) via custom SQL — catalog/billing seeds come from init + seed files.

## Post-cutover verification

- [ ] `make migrate` exits 0 on all 9 databases
- [ ] Login (Yandex / Telegram)
- [ ] Mock interview → submit → AI eval → Today updates
- [ ] Billing limits match expected (`GET /v1/billing/me`)
- [ ] `./scripts/smoke-core-loop.sh` passes (see deploy Makefile)

## Rollback

- Restore from backup volume or `pg_dump` files.
- Redeploy previous git tag with old migration files.

See also: [RUNBOOK.md](../RUNBOOK.md) § migrations failed, [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md).
