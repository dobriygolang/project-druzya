#!/usr/bin/env bash
# Canonical service lists — edit HERE when adding a service.
# Verify: bash deploy/scripts/verify-service-registry.sh
# Cursor: .cursor/rules/service-registry.mdc

# Skeleton only; not linted in CI or deployed.
TEMPLATE_SERVICE=template

# GitHub Actions golangci-lint + test + build matrix.
# go.work must include every entry (plus template).
CI_SERVICES=(
  identity
  ai
  billing
  sandbox
  rooms
  tracker
  notes
  focus
)

# buf generate → services/<name>/pkg/api (gitignored; CI runs gen-all-proto.sh first).
PROTO_SERVICES=("${CI_SERVICES[@]}")

# Prod docker-compose app services (HTTP backends). Add here when the service ships.
PROD_APP_SERVICES=(
  identity
  billing
  sandbox
  rooms
  tracker
  notes
  focus
)

# Postgres DBs in prod migrate image (Dockerfile.migrate + migrate-all.sh + init-databases.sql).
DB_SERVICES=(
  identity
  billing
  sandbox
  rooms
  tracker
  notes
  focus
)

db_name_for_service() {
  case "$1" in
    identity) echo druzya ;;
    ai) echo druzya_ai ;;
    billing) echo druzya_billing ;;
    sandbox) echo druzya_sandbox ;;
    rooms) echo druzya_rooms ;;
    tracker) echo druzya_tracker ;;
    notes) echo druzya_notes ;;
    focus) echo druzya_focus ;;
    *) return 1 ;;
  esac
}

dsn_env_for_service() {
  case "$1" in
    identity) echo IDENTITY_POSTGRES_DSN ;;
    ai) echo AI_POSTGRES_DSN ;;
    billing) echo BILLING_POSTGRES_DSN ;;
    sandbox) echo SANDBOX_POSTGRES_DSN ;;
    rooms) echo ROOMS_POSTGRES_DSN ;;
    tracker) echo TRACKER_POSTGRES_DSN ;;
    notes) echo NOTES_POSTGRES_DSN ;;
    focus) echo FOCUS_POSTGRES_DSN ;;
    *) return 1 ;;
  esac
}

DB_DATABASES=()
for _db_svc in "${DB_SERVICES[@]}"; do
  DB_DATABASES+=("$(db_name_for_service "$_db_svc")")
done

# Default HTTP port per service (local dev / smoke against host-mapped ports).
service_http_port() {
  case "$1" in
    identity) echo 8080 ;;
    ai) echo 8083 ;;
    billing) echo 8085 ;;
    sandbox) echo 8086 ;;
    rooms) echo 8087 ;;
    tracker) echo 8089 ;;
    notes) echo 8090 ;;
    focus) echo 8091 ;;
    *) return 1 ;;
  esac
}

clear_pkg_api() {
  local root="${1:?repo root}"
  for svc in "${PROTO_SERVICES[@]}"; do
    rm -rf "$root/services/$svc/pkg/api"
  done
}

verify_pkg_api() {
  local root="${1:?repo root}"
  local missing=0
  for svc in "${PROTO_SERVICES[@]}"; do
    if [ ! -d "$root/services/$svc/pkg/api" ] || [ -z "$(ls -A "$root/services/$svc/pkg/api" 2>/dev/null)" ]; then
      echo "verify-pkg-api: missing services/$svc/pkg/api" >&2
      missing=1
    fi
  done
  return "$missing"
}

pack_pkg_api_paths() {
  for svc in "${PROTO_SERVICES[@]}"; do
    printf '%s\n' "services/$svc/pkg/api"
  done
}

# Exit 0 when SQL migrations changed between two commits.
migrations_changed() {
  local from="${1:?from sha required}"
  local to="${2:?to sha required}"

  if [ "$from" = "$to" ]; then
    return 1
  fi

  if git diff --name-only "$from" "$to" 2>/dev/null | grep -qE '^services/.+/scripts/migrations/|^deploy/Dockerfile\.migrate|^deploy/scripts/migrate-all\.sh'; then
    return 0
  fi

  return 1
}
