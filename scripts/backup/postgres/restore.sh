#!/bin/bash

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Load environment variables
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment from $ENV_FILE"
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

# Check arguments
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file_path>"
  echo "Example: $0 ./backups/teachlink_20240428_100000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: ${BACKUP_FILE}"
  exit 1
fi

echo "--- Database Restore Started at $(date) ---"
echo "Source: ${BACKUP_FILE}"
echo "Target: ${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Warning and confirmation
echo "WARNING: This will overwrite the existing database '${DB_NAME}'."
read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

# Drop and recreate database (optional, but cleaner)
# PGPASSWORD="${DB_PASSWORD}" dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" --if-exists "${DB_NAME}"
# PGPASSWORD="${DB_PASSWORD}" createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"

# Decompress and restore using psql
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"

if [ $? -eq 0 ]; then
  echo "SUCCESS: Database restored successfully."
  echo "--- Database Restore Finished at $(date) ---"
else
  echo "ERROR: Restore failed!"
  exit 1
fi
