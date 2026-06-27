#!/usr/bin/env bash
# Safe post-deploy cleanup: dangling images + old build cache.
# Does NOT remove running containers, named volumes, or tagged images still in use.
set -euo pipefail

BUILD_CACHE_UNTIL="${BUILD_CACHE_UNTIL:-168h}"

echo "Removing dangling images (untagged layers from rebuilds)..."
docker image prune -f

echo "Removing build cache older than ${BUILD_CACHE_UNTIL}..."
docker builder prune -f --filter "until=${BUILD_CACHE_UNTIL}"

echo "Disk usage after prune:"
docker system df
