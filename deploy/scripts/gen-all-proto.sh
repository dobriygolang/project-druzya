#!/usr/bin/env bash
# Generate pkg/api for all production services (run on CI runner, not on VPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN_DIR="$ROOT/deploy/.proto-bin"
SERVICES=(identity content interview ai recommendation billing sandbox rooms admin)

# shellcheck source=/dev/null
source "$ROOT/deploy/scripts/install-proto-tools.sh"
export PATH="$BIN_DIR:$PATH"

gen_one() {
  local svc="$1"
  echo "buf generate: $svc"
  (cd "$ROOT/services/$svc" && buf generate)
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
