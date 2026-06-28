#!/usr/bin/env bash
# Exit 0 when SQL migrations changed between two commits.
set -euo pipefail

FROM="${1:?from sha required}"
TO="${2:?to sha required}"

if [ "$FROM" = "$TO" ]; then
  exit 1
fi

if git diff --name-only "$FROM" "$TO" 2>/dev/null | grep -qE '^services/.+/scripts/migrations/|^deploy/Dockerfile\.migrate|^deploy/scripts/migrate-all\.sh'; then
  exit 0
fi

exit 1
