#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=services.conf.sh
source "$ROOT/deploy/scripts/services.conf.sh"

run_migrate() {
  local name="$1"
  local dsn="$2"
  local dir="$3"
  echo "==> migrate ${name}"
  goose -dir "$dir" postgres "$dsn" up
}

for svc in "${DB_SERVICES[@]}"; do
  dsn_var="$(dsn_env_for_service "$svc")"
  run_migrate "$svc" "${!dsn_var}" "/migrations/$svc"
done

echo "all migrations applied"
