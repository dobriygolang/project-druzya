#!/usr/bin/env bash
# Append missing *_POSTGRES_DSN lines to deploy/.env (existing prod servers).
set -euo pipefail

ENV_FILE="${1:-.env}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=services.conf.sh
source "$SCRIPT_DIR/services.conf.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "ensure-env-dsns: ${ENV_FILE} not found" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER required in ${ENV_FILE}}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required in ${ENV_FILE}}"

for svc in "${DB_SERVICES[@]}"; do
  dsn_var="$(dsn_env_for_service "$svc")"
  db="$(db_name_for_service "$svc")"
  current="${!dsn_var:-}"
  if [ -n "$current" ]; then
    continue
  fi
  if grep -qE "^${dsn_var}=" "$ENV_FILE"; then
    echo "ensure-env-dsns: ${dsn_var} is empty in ${ENV_FILE}" >&2
    exit 1
  fi
  dsn="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${db}?sslmode=disable"
  echo "${dsn_var}=${dsn}" >>"$ENV_FILE"
  echo "ensure-env-dsns: added ${dsn_var}"
done
