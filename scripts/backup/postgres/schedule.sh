#!/bin/bash

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKUP_SCRIPT="${PROJECT_ROOT}/scripts/backup/postgres/backup.sh"
RETENTION_SCRIPT="${PROJECT_ROOT}/scripts/backup/postgres/retention.sh"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Default schedule: Daily at 2:00 AM
CRON_SCHEDULE="0 2 * * *"

echo "--- Setting up Automated Backup Schedule ---"

# Check if scripts exist
if [ ! -f "$BACKUP_SCRIPT" ] || [ ! -f "$RETENTION_SCRIPT" ]; then
  echo "ERROR: Backup scripts not found at:"
  echo "  $BACKUP_SCRIPT"
  echo "  $RETENTION_SCRIPT"
  exit 1
fi

# Add execution permissions
chmod +x "$BACKUP_SCRIPT" "$RETENTION_SCRIPT"

# Ensure backup directory exists for logs
mkdir -p "$BACKUP_DIR"

# Prepare the cron command
# We use absolute paths for scripts and logs
CRON_CMD="${CRON_SCHEDULE} /bin/bash ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1 && /bin/bash ${RETENTION_SCRIPT} >> ${LOG_FILE} 2>&1"

# Check if already scheduled
(crontab -l 2>/dev/null | grep -F "${BACKUP_SCRIPT}") > /dev/null
if [ $? -eq 0 ]; then
  echo "INFO: Backup already scheduled in crontab."
  echo "Current entry:"
  crontab -l | grep -F "${BACKUP_SCRIPT}"
  echo "To update, edit crontab manually (crontab -e) or clear existing entries."
else
  # Add to crontab
  (crontab -l 2>/dev/null; echo "${CRON_CMD}") | crontab -
  if [ $? -eq 0 ]; then
    echo "SUCCESS: Automated backup scheduled: ${CRON_SCHEDULE}"
    echo "Logs will be written to: ${LOG_FILE}"
  else
    echo "ERROR: Failed to update crontab."
    exit 1
  fi
fi
