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

for svc in "${DB_SERVICES[@]}"; do
  dsn_var="$(dsn_env_for_service "$svc")"
  run_migrate "$svc" "${!dsn_var}" "/migrations/$svc"
done

echo "all migrations applied"
