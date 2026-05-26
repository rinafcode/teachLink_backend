#!/bin/bash

# Configuration
# Navigating to the project root assuming script is in scripts/backup/postgres/
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Load environment variables
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment from $ENV_FILE"
  # Export variables while ignoring comments
  set -a
  source <(grep -v '^#' "$ENV_FILE")
  set +a
fi

# Database Configuration
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_NAME=${DATABASE_NAME:-teachlink}
DB_USER=${DATABASE_USER:-postgres}
DB_PASSWORD=${DATABASE_PASSWORD:-postgres}

# Backup Configuration
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "--- Database Backup Started at $(date) ---"
echo "Target: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "File:   ${BACKUP_FILE}"

# Perform backup using pg_dump (Plain SQL format, piped to gzip)
PGPASSWORD="${DB_PASSWORD}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F p "${DB_NAME}" | gzip > "${BACKUP_FILE}"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "SUCCESS: Backup completed. Size: ${BACKUP_SIZE}"
  echo "--- Database Backup Finished at $(date) ---"
else
  echo "ERROR: Backup failed!"
  # Cleanup empty file if failed
  rm -f "${BACKUP_FILE}"
  exit 1
fi
