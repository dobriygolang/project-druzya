#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/jwt"
mkdir -p "$DIR"

openssl genrsa -out "$DIR/private.pem" 2048
openssl rsa -in "$DIR/private.pem" -pubout -out "$DIR/public.pem"

echo "generated:"
echo "  $DIR/private.pem"
echo "  $DIR/public.pem"
