#!/usr/bin/env bash
# Fail when CI / go.work / deploy scripts drift from deploy/scripts/services.conf.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=services.conf.sh
source "$ROOT/deploy/scripts/services.conf.sh"

fail=0

sorted_lines() {
  printf '%s\n' "$@" | sort
}

expect="$(sorted_lines "${CI_SERVICES[@]}")"

check_set() {
  local label="$1"
  local actual="$2"
  if [ "$actual" != "$expect" ]; then
    echo "verify-service-registry: ${label} mismatch" >&2
    echo "  expected: $(echo "$expect" | tr '\n' ' ')" >&2
    echo "  actual:   $(echo "$actual" | tr '\n' ' ')" >&2
    fail=1
  fi
}

ci_matrix="$(
  grep -E '^\s+service:\s+\[' "$ROOT/.github/workflows/ci.yml" \
    | head -1 \
    | sed -E 's/.*\[(.*)\].*/\1/' \
    | tr ',' '\n' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
    | grep -v '^$' \
    | sort
)"
check_set "ci.yml matrix.service" "$ci_matrix"

for svc in "${CI_SERVICES[@]}"; do
  if ! grep -q "./services/${svc}" "$ROOT/go.work"; then
    echo "verify-service-registry: go.work missing ./services/${svc}" >&2
    fail=1
  fi
done

init_sql="$ROOT/deploy/scripts/init-databases.sql"
for db in "${DB_DATABASES[@]}"; do
  if [ "$db" = "druzya" ]; then
    continue
  fi
  if ! grep -q "CREATE DATABASE ${db};" "$init_sql"; then
    echo "verify-service-registry: init-databases.sql missing CREATE DATABASE ${db}" >&2
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "Fix lists in deploy/scripts/services.conf.sh and sync dependents — see .cursor/rules/service-registry.mdc" >&2
  exit 1
fi

echo "verify-service-registry: ok (${#CI_SERVICES[@]} CI services, ${#DB_DATABASES[@]} DBs)"
