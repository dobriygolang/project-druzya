#!/usr/bin/env bash
# Map git diff to docker compose service names that need image rebuild.
# Usage: changed-services.sh <from_sha> <to_sha>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=services.conf.sh
source "$ROOT/deploy/scripts/services.conf.sh"

FROM="${1:?from sha required}"
TO="${2:?to sha required}"

if [ "$FROM" = "$TO" ]; then
  exit 0
fi

files="$(git diff --name-only "$FROM" "$TO" 2>/dev/null || true)"
if [ -z "$files" ]; then
  exit 0
fi

# Shared build inputs — rebuild the whole stack.
if echo "$files" | grep -qE '^(deploy/Dockerfile($|\.)|go\.work)'; then
  echo "${PROD_APP_SERVICES[*]} identity-bot caddy migrate"
  exit 0
fi

want=""

add() {
  case " $want " in
    *" $1 "*) ;;
    *)
      if [ -z "$want" ]; then
        want="$1"
      else
        want="$want $1"
      fi
      ;;
  esac
}

expand() {
  case "$1" in
    identity) add billing; add rooms ;;
    billing) add sandbox; add rooms ;;
    sandbox) add caddy ;;
    rooms) add caddy ;;
    tracker) add caddy ;;
    notes) add caddy ;;
    focus) add caddy ;;
  esac
}

direct=""
for svc in "${PROD_APP_SERVICES[@]}"; do
  if echo "$files" | grep -q "^services/${svc}/"; then
    direct="$direct $svc"
  fi
done

for svc in $direct; do
  add "$svc"
  expand "$svc"
done

if echo "$files" | grep -q "^services/identity/"; then
  add identity-bot
fi

if echo "$files" | grep -qE '^(apps/web/|deploy/Caddyfile|deploy/Dockerfile\.caddy|deploy/static/)'; then
  add caddy
fi

if echo "$files" | grep -qE '^services/.+/scripts/migrations/' || echo "$files" | grep -q '^deploy/Dockerfile\.migrate'; then
  add migrate
fi

if [ -z "$want" ]; then
  exit 0
fi

echo "$want"
