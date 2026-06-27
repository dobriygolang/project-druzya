#!/usr/bin/env bash
# Generate pkg/api for all production services (run on CI runner, not on VPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICES=(identity content interview ai recommendation billing sandbox rooms)

gen_one() {
  local svc="$1"
  echo "gen-proto: $svc"
  (cd "$ROOT/services/$svc" && GOWORK=off make gen-proto)
}

pids=()
for svc in "${SERVICES[@]}"; do
  gen_one "$svc" &
  pids+=($!)
done

fail=0
for pid in "${pids[@]}"; do
  if ! wait "$pid"; then
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "gen-all-proto: one or more services failed" >&2
  exit 1
fi

echo "gen-all-proto: ok"
