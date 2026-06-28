#!/usr/bin/env bash
# Drop and recreate all application databases (empty schema; run migrate after).
set -euo pipefail

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

PGHOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-druzya}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

psql_admin() {
  if [[ "${USE_DOCKER_POSTGRES:-}" == "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE:-.env}" exec -T postgres \
      psql -U "${PGUSER}" -d postgres -v ON_ERROR_STOP=1 "$@"
  else
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 "$@"
  fi
}

DATABASES=(
  druzya
  druzya_content
  druzya_interview
  druzya_ai
  druzya_recommendation
  druzya_billing
  druzya_sandbox
  druzya_rooms
)

for db in "${DATABASES[@]}"; do
  echo "==> reset database ${db}"
  psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();"
  psql_admin -c "DROP DATABASE IF EXISTS \"${db}\";"
  psql_admin -c "CREATE DATABASE \"${db}\";"
done

echo "all databases reset — run: docker compose -f ${COMPOSE_FILE} run --rm migrate"
