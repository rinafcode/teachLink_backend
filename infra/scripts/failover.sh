#!/usr/bin/env bash
#
# failover.sh — Activate or fail back the TeachLink multi-region deployment.
#
# This script automates the manual steps of a regional failover for the
# infrastructure provisioned by tf/multi-region:
#   1. Promote the secondary-region RDS read replica to a standalone primary.
#   2. Scale up the secondary-region ECS service.
#   3. Let Route 53 health checks shift traffic (no manual DNS edit needed).
#
# Route 53 failover routing already redirects traffic automatically when the
# primary health check goes red; this script handles the data-tier promotion
# and capacity changes that are NOT automatic.
#
# Usage:
#   ./failover.sh activate   [--dry-run]
#   ./failover.sh failback   [--dry-run]
#   ./failover.sh status
#
# Requires: awscli v2, jq. Configure via the environment variables below.
set -euo pipefail

PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
REPLICA_DB_ID="${REPLICA_DB_ID:-teachlink-${ENVIRONMENT}-db-replica}"
PRIMARY_DB_ID="${PRIMARY_DB_ID:-teachlink-${ENVIRONMENT}-db}"
SECONDARY_CLUSTER="${SECONDARY_CLUSTER:-teachlink-cluster-secondary}"
SECONDARY_SERVICE="${SECONDARY_SERVICE:-teachlink-service-secondary}"
FAILOVER_DESIRED_COUNT="${FAILOVER_DESIRED_COUNT:-10}"

DRY_RUN=0
log() { printf '[failover] %s\n' "$*"; }
run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: $*"
  else
    log "RUN: $*"
    "$@"
  fi
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: '$1' is required but not installed." >&2
    exit 1
  }
}

activate() {
  log "Activating failover: ${PRIMARY_REGION} -> ${SECONDARY_REGION} (env=${ENVIRONMENT})"

  log "Step 1/3: Promoting read replica '${REPLICA_DB_ID}' in ${SECONDARY_REGION} to standalone primary"
  run aws rds promote-read-replica \
    --db-instance-identifier "${REPLICA_DB_ID}" \
    --region "${SECONDARY_REGION}"

  log "Waiting for the promoted instance to become available..."
  run aws rds wait db-instance-available \
    --db-instance-identifier "${REPLICA_DB_ID}" \
    --region "${SECONDARY_REGION}"

  log "Step 2/3: Scaling secondary ECS service to ${FAILOVER_DESIRED_COUNT} tasks"
  run aws ecs update-service \
    --cluster "${SECONDARY_CLUSTER}" \
    --service "${SECONDARY_SERVICE}" \
    --desired-count "${FAILOVER_DESIRED_COUNT}" \
    --region "${SECONDARY_REGION}"

  log "Step 3/3: Route 53 health-check failover handles DNS automatically."
  log "          Verify: dig +short api.\${DOMAIN} should resolve to the ${SECONDARY_REGION} ALB."
  log "Failover activation complete. Update application DB_HOST/REDIS_HOST to the secondary endpoints."
}

failback() {
  log "Failing back: ${SECONDARY_REGION} -> ${PRIMARY_REGION} (env=${ENVIRONMENT})"
  log "WARNING: Failback is high-risk. Only run after the primary region is fully recovered"
  log "         and data has been re-synced to ${PRIMARY_DB_ID}. See dr/procedures/failover-plan.md."

  log "Step 1/2: Confirm primary database is healthy and re-seeded"
  run aws rds wait db-instance-available \
    --db-instance-identifier "${PRIMARY_DB_ID}" \
    --region "${PRIMARY_REGION}"

  log "Step 2/2: Scaling secondary ECS service back down to standby (1 task)"
  run aws ecs update-service \
    --cluster "${SECONDARY_CLUSTER}" \
    --service "${SECONDARY_SERVICE}" \
    --desired-count 1 \
    --region "${SECONDARY_REGION}"

  log "Failback initiated. Route 53 will return traffic to ${PRIMARY_REGION} once its health check is green."
}

status() {
  log "Primary RDS (${PRIMARY_REGION}):"
  aws rds describe-db-instances --db-instance-identifier "${PRIMARY_DB_ID}" \
    --region "${PRIMARY_REGION}" \
    --query 'DBInstances[0].{Status:DBInstanceStatus,Role:ReadReplicaSourceDBInstanceIdentifier}' \
    --output table 2>/dev/null || log "  (not found)"

  log "Secondary RDS (${SECONDARY_REGION}):"
  aws rds describe-db-instances --db-instance-identifier "${REPLICA_DB_ID}" \
    --region "${SECONDARY_REGION}" \
    --query 'DBInstances[0].{Status:DBInstanceStatus,ReplicaOf:ReadReplicaSourceDBInstanceIdentifier}' \
    --output table 2>/dev/null || log "  (not found)"

  log "Secondary ECS service (${SECONDARY_REGION}):"
  aws ecs describe-services --cluster "${SECONDARY_CLUSTER}" --services "${SECONDARY_SERVICE}" \
    --region "${SECONDARY_REGION}" \
    --query 'services[0].{Desired:desiredCount,Running:runningCount}' \
    --output table 2>/dev/null || log "  (not found)"
}

main() {
  require aws
  local action="${1:-}"
  shift || true
  for arg in "$@"; do
    [[ "$arg" == "--dry-run" ]] && DRY_RUN=1
  done

  case "$action" in
    activate) activate ;;
    failback) failback ;;
    status) status ;;
    *)
      echo "Usage: $0 {activate|failback|status} [--dry-run]" >&2
      exit 1
      ;;
  esac
}

main "$@"
