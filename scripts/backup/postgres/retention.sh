#!/bin/bash

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Load environment variables for retention config if present
if [ -f "$ENV_FILE" ]; then
  set -a
  source <(grep -v '^#' "$ENV_FILE")
  set +a
fi

BACKUP_DIR="${PROJECT_ROOT}/backups"
# Default retention is 7 days if not specified in .env
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

echo "--- Backup Retention Cleanup Started at $(date) ---"
echo "Backup Directory: ${BACKUP_DIR}"
echo "Retention Period: ${RETENTION_DAYS} days"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "INFO: Backup directory does not exist. Skipping cleanup."
  exit 0
fi

# Find and delete files older than RETENTION_DAYS
# We specifically look for .sql.gz files created by the backup script
DELETED_FILES=$(find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +"${RETENTION_DAYS}" -print)
DELETED_COUNT=$(echo "$DELETED_FILES" | grep -c . || echo 0)

if [ "$DELETED_COUNT" -gt 0 ]; then
  echo "Deleting the following files:"
  echo "$DELETED_FILES"
  find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
  echo "SUCCESS: Deleted ${DELETED_COUNT} expired backup(s)."
else
  echo "INFO: No expired backups found."
fi

echo "--- Backup Retention Cleanup Finished at $(date) ---"
