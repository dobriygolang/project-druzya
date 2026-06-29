#!/usr/bin/env bash
# Production image build with BuildKit caches (run on the VPS from deploy/).
set -euo pipefail

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-4}"
# Provenance attestations can yield compose exit 1 even when images are tagged.
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)
# Must match `name:` in docker-compose.prod.yml.
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-druzya-prod}"

image_ref_for_service() {
  local svc="$1"
  echo "${COMPOSE_PROJECT}-${svc}:latest"
}

image_exists() {
  local svc="$1"
  local ref
  ref="$(image_ref_for_service "$svc")"
  docker image inspect "$ref" >/dev/null 2>&1
}

verify_images() {
  local missing=0
  local svc
  for svc in "$@"; do
    if image_exists "$svc"; then
      echo "build verify: ok ${svc} ($(image_ref_for_service "$svc"))"
    else
      echo "build verify: missing ${svc} ($(image_ref_for_service "$svc"))"
      missing=1
    fi
  done
  if [ "$missing" -eq 0 ]; then
    return 0
  fi
  return 1
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

echo "docker compose build exited ${rc} (checking tagged images...)"

if [ ${#services[@]} -gt 0 ] && verify_images "${services[@]}"; then
  echo "build: target images present despite compose exit ${rc} — continuing deploy"
  exit 0
fi

exit "$rc"
