#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT"

: "${POSTGRES_USER:?POSTGRES_USER required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
: "${POSTGRES_HOST:=postgres}"

export PGPASSWORD="$POSTGRES_PASSWORD"

dbs=(druzya druzya_content druzya_interview druzya_ai druzya_recommendation)
for db in "${dbs[@]}"; do
  echo "==> dump $db"
  pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -Fc "$db" > "$OUT/${db}.dump"
done

tar -czf "$BACKUP_DIR/druzya_${STAMP}.tar.gz" -C "$BACKUP_DIR" "$STAMP"
rm -rf "$OUT"

echo "backup: $BACKUP_DIR/druzya_${STAMP}.tar.gz"

# Cron example (daily 03:00 UTC, run from deploy/ with .env loaded):
# 0 3 * * * cd /opt/project-druzya/deploy && set -a && source .env && set +a && ./scripts/backup-postgres.sh
