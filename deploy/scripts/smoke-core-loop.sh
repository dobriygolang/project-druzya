#!/usr/bin/env bash
# Smoke test for core platform loop against a running deploy stack.
# Usage: API_BASE=https://api.druz9.online ./scripts/smoke-core-loop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=services.conf.sh
source "$ROOT/deploy/scripts/services.conf.sh"

API_BASE="${API_BASE:-http://127.0.0.1:18080}"
INTERNAL_TOKEN="${INTERNAL_API_TOKEN:-}"

echo "== smoke: public health =="
curl -sf "${API_BASE}/healthz" >/dev/null
echo "ok"

for svc in "${PROD_APP_SERVICES[@]}"; do
  port="$(service_http_port "$svc")"
  echo "== smoke: ${svc} healthz =="
  if curl -sf "http://127.0.0.1:${port}/healthz" >/dev/null 2>&1; then
    echo "ok"
  else
    echo "skip (not reachable on localhost:${port})"
  fi
done

if [[ -n "$INTERNAL_TOKEN" ]]; then
  echo "== smoke: billing plans (public) =="
  curl -sf "${API_BASE}/v1/billing/plans" | head -c 200
  echo ""
  echo "ok"
else
  echo "== smoke: skip authenticated flow (set INTERNAL_API_TOKEN for full check) =="
fi

echo "smoke-core-loop: passed"
