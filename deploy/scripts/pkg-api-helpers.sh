#!/usr/bin/env bash
# Shared list of services that publish pkg/api from buf.
PROTO_SERVICES=(identity content interview ai recommendation billing sandbox rooms admin tracker)

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
