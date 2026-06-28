#!/usr/bin/env bash
# Production image build with BuildKit caches (run on the VPS from deploy/).
set -euo pipefail

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-4}"
# Provenance attestations can yield compose exit 1 even when images are tagged.
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)

verify_images() {
  local missing=0
  for svc in "$@"; do
    if ! "${COMPOSE[@]}" images -q "$svc" 2>/dev/null | grep -q .; then
      echo "build verify: no image for service ${svc}" >&2
      missing=1
    fi
  done
  return $missing
}

services=()
if [ $# -gt 0 ]; then
  services=("$@")
fi

set +e
if [ ${#services[@]} -eq 0 ]; then
  "${COMPOSE[@]}" build
else
  "${COMPOSE[@]}" build "${services[@]}"
fi
rc=$?
set -e

if [ "$rc" -eq 0 ]; then
  exit 0
fi

echo "docker compose build exited ${rc}" >&2

if [ ${#services[@]} -gt 0 ] && verify_images "${services[@]}"; then
  echo "build: target images present despite compose exit ${rc} — continuing deploy" >&2
  exit 0
fi

exit "$rc"
