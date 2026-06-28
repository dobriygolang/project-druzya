#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${ROOT}/secrets/jwt"
mkdir -p "$DIR"

if [[ -f "$DIR/private.pem" && -f "$DIR/public.pem" ]]; then
  echo "JWT keys already exist in $DIR (skip)"
  chmod 644 "$DIR/private.pem" "$DIR/public.pem" 2>/dev/null || true
  exit 0
fi

openssl genrsa -out "$DIR/private.pem" 2048
openssl rsa -in "$DIR/private.pem" -pubout -out "$DIR/public.pem"
# Containers run as USER nobody — keys must be world-readable on the mounted volume.
chmod 644 "$DIR/private.pem" "$DIR/public.pem"

echo "generated:"
echo "  $DIR/private.pem"
echo "  $DIR/public.pem"
