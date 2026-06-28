#!/usr/bin/env bash
# Generate pkg/api for all production services (run on CI runner, not on VPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN_DIR="$ROOT/deploy/.proto-bin"
TOOL_MOD_DIR="$ROOT/services/identity"
# shellcheck source=services.conf.sh
source "$ROOT/deploy/scripts/services.conf.sh"

install_proto_tools() {
  mkdir -p "$BIN_DIR"
  export GOWORK=off
  export GOBIN="$BIN_DIR"
  export PATH="$BIN_DIR:$PATH"

  local need_plugins=0
  for bin in protoc-gen-go protoc-gen-go-grpc protoc-gen-grpc-gateway; do
    if [ ! -x "$BIN_DIR/$bin" ]; then
      need_plugins=1
      break
    fi
  done

  if [ "$need_plugins" -eq 1 ]; then
    echo "gen-all-proto: installing protoc plugins into $BIN_DIR"
    (
      cd "$TOOL_MOD_DIR"
      go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11 &
      pid_go=$!
      go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.2 &
      pid_grpc=$!
      go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.29.0 &
      pid_gw=$!
      wait "$pid_go" "$pid_grpc" "$pid_gw"
    )
  else
    echo "gen-all-proto: protoc plugins cached"
  fi

  if ! command -v buf >/dev/null 2>&1; then
    echo "gen-all-proto: buf not on PATH, installing via go install"
    (cd "$TOOL_MOD_DIR" && go install github.com/bufbuild/buf/cmd/buf@v1.47.0)
  fi

  echo "gen-all-proto: $(buf --version)"
}

install_proto_tools
export PATH="$BIN_DIR:$PATH"

gen_one() {
  local svc="$1"
  echo "buf generate: $svc"
  (cd "$ROOT/services/$svc" && buf generate)
}

pids=()
for svc in "${PROTO_SERVICES[@]}"; do
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
