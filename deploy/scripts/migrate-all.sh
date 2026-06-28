#!/usr/bin/env bash
set -euo pipefail

run_migrate() {
  local name="$1"
  local dsn="$2"
  local dir="$3"
  echo "==> migrate ${name}"
  goose -dir "$dir" -allow-missing postgres "$dsn" up
}

run_migrate identity "${IDENTITY_POSTGRES_DSN}" /migrations/identity
run_migrate content "${CONTENT_POSTGRES_DSN}" /migrations/content
run_migrate interview "${INTERVIEW_POSTGRES_DSN}" /migrations/interview
run_migrate ai "${AI_POSTGRES_DSN}" /migrations/ai
run_migrate recommendation "${RECOMMENDATION_POSTGRES_DSN}" /migrations/recommendation
run_migrate billing "${BILLING_POSTGRES_DSN}" /migrations/billing
run_migrate sandbox "${SANDBOX_POSTGRES_DSN}" /migrations/sandbox
run_migrate rooms "${ROOMS_POSTGRES_DSN}" /migrations/rooms

echo "all migrations applied"
