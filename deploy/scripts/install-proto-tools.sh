#!/usr/bin/env bash
# Install buf + protoc plugins once (shared by gen-all-proto.sh and CI).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN_DIR="${PROTO_BIN_DIR:-$ROOT/deploy/.proto-bin}"

mkdir -p "$BIN_DIR"
export GOWORK=off
export GOBIN="$BIN_DIR"
export PATH="$BIN_DIR:$PATH"

need_plugins=0
for bin in protoc-gen-go protoc-gen-go-grpc protoc-gen-grpc-gateway; do
  if [ ! -x "$BIN_DIR/$bin" ]; then
    need_plugins=1
    break
  fi
done

if [ "$need_plugins" -eq 1 ]; then
  echo "install-proto-tools: installing protoc plugins into $BIN_DIR"
  go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11 &
  pid_go=$!
  go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.2 &
  pid_grpc=$!
  go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.29.0 &
  pid_gw=$!
  wait "$pid_go" "$pid_grpc" "$pid_gw"
else
  echo "install-proto-tools: protoc plugins cached"
fi

if ! command -v buf >/dev/null 2>&1; then
  echo "install-proto-tools: buf not on PATH, installing via go install"
  go install github.com/bufbuild/buf/cmd/buf@v1.47.0
fi

echo "install-proto-tools: $(buf --version)"
