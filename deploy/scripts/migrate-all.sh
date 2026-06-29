#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/services.conf.sh" ]; then
  # shellcheck source=services.conf.sh
  source "$SCRIPT_DIR/services.conf.sh"
elif [ -f /services.conf.sh ]; then
  # shellcheck source=/services.conf.sh
  source /services.conf.sh
else
  echo "migrate-all: services.conf.sh not found" >&2
  exit 1
fi

run_migrate() {
  local name="$1"
  local dsn="$2"
  local dir="$3"
  echo "==> migrate ${name}"
  goose -dir "$dir" postgres "$dsn" up
}

dsn_for_service() {
  local svc="$1"
  local dsn_var dsn db user pass
  dsn_var="$(dsn_env_for_service "$svc")"
  dsn="${!dsn_var:-}"
  if [ -n "$dsn" ]; then
    echo "$dsn"
    return 0
  fi
  db="$(db_name_for_service "$svc")"
  user="${POSTGRES_USER:-druzya}"
  pass="${POSTGRES_PASSWORD:-}"
  if [ -z "$pass" ]; then
    echo "migrate-all: ${dsn_var} is not set and POSTGRES_PASSWORD is empty" >&2
    return 1
  fi
  echo "postgres://${user}:${pass}@postgres:5432/${db}?sslmode=disable"
}

for svc in "${DB_SERVICES[@]}"; do
  dsn="$(dsn_for_service "$svc")"
  run_migrate "$svc" "$dsn" "/migrations/$svc"
done

echo "all migrations applied"
