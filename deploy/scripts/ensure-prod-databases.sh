#!/usr/bin/env bash
# Create service DBs on existing Postgres volumes (init-databases.sql runs once only).
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=services.conf.sh
source "$SCRIPT_DIR/services.conf.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "ensure-prod-databases: ${ENV_FILE} not found" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER required}"

for db in "${DB_DATABASES[@]}"; do
  if [ "$db" = "druzya" ]; then
    continue
  fi
  exists="$(
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
      psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" \
      | tr -d '[:space:]'
  )"
  if [ "$exists" = "1" ]; then
    continue
  fi
  echo "ensure-prod-databases: creating ${db}"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${db};"
done
