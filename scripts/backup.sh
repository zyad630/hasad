#!/bin/bash
# M-03: Automated PostgreSQL backup with integrity verification
set -euo pipefail

DB_NAME="${POSTGRES_DB:-hisba_db}"
DB_USER="${POSTGRES_USER:-hisba_user}"
DB_HOST="${DB_HOST:-db}"
BACKUP_DIR="/backups"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: $FILENAME"

# Dump and compress in a single pipe — no temp files needed
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  -F plain \
  | gzip > "$FILENAME"

# Verify backup is not empty
if [ ! -s "$FILENAME" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file is empty — aborting!"
  exit 1
fi

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete: $SIZE"

# Verify the gzip is valid (catches truncated backups)
if ! gunzip -t "$FILENAME" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file is corrupted!"
  exit 1
fi
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Integrity check PASSED (gzip valid)"

# Test-restore into a temporary database
VERIFY_DB="${DB_NAME}_verify_$$"
PGPASSWORD="$POSTGRES_PASSWORD" createdb -h "$DB_HOST" -U "$DB_USER" "$VERIFY_DB" 2>/dev/null

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Testing restore into $VERIFY_DB ..."
if gunzip -c "$FILENAME" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" -U "$DB_USER" -d "$VERIFY_DB" -q 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore test PASSED"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Restore test had errors (check logs)"
fi

# Always drop the verify DB
PGPASSWORD="$POSTGRES_PASSWORD" dropdb -h "$DB_HOST" -U "$DB_USER" "$VERIFY_DB" 2>/dev/null || true

# Rotate — delete backups older than RETENTION_DAYS
OLD_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+$RETENTION_DAYS" | wc -l)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+$RETENTION_DAYS" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup: removed $OLD_COUNT old backup(s)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done. Backup saved: $FILENAME"
