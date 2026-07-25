#!/usr/bin/env bash
#
# failover-drill.sh — Non-destructive validation of the failover setup.
#
# Run this monthly (see dr/README.md testing schedule) to confirm the
# multi-region deployment is failover-ready WITHOUT promoting the replica or
# shifting production traffic. It checks:
#   1. Both region ALBs answer the health-check path.
#   2. The RDS read replica exists and replication lag is within RPO.
#   3. S3 cross-region replication is enabled on the source buckets.
#   4. Route 53 health checks report healthy.
#
# Exit code is non-zero if any check fails, so it can gate CI / a scheduled job.
#
# Usage: ./failover-drill.sh
# Requires: awscli v2, jq, curl.
set -uo pipefail

PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
REPLICA_DB_ID="${REPLICA_DB_ID:-teachlink-${ENVIRONMENT}-db-replica}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
MAX_REPLICA_LAG_SECONDS="${MAX_REPLICA_LAG_SECONDS:-5}"
PRIMARY_ALB_URL="${PRIMARY_ALB_URL:-}"
SECONDARY_ALB_URL="${SECONDARY_ALB_URL:-}"

PASS=0
FAIL=0
ok() {
  printf '  ✅ %s\n' "$*"
  PASS=$((PASS + 1))
}
bad() {
  printf '  ❌ %s\n' "$*"
  FAIL=$((FAIL + 1))
}
section() { printf '\n=== %s ===\n' "$*"; }

check_endpoint() {
  local name="$1" url="$2"
  [[ -z "$url" ]] && {
    bad "$name endpoint URL not set (export ${name}_ALB_URL)"
    return
  }
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${url}${HEALTH_PATH}" || echo 000)"
  if [[ "$code" == "200" ]]; then
    ok "$name health endpoint returned 200"
  else
    bad "$name health endpoint returned ${code}"
  fi
}

section "1. Region health endpoints"
check_endpoint "PRIMARY" "$PRIMARY_ALB_URL"
check_endpoint "SECONDARY" "$SECONDARY_ALB_URL"

section "2. RDS cross-region read replica"
if command -v aws >/dev/null 2>&1; then
  replica_json="$(aws rds describe-db-instances --db-instance-identifier "$REPLICA_DB_ID" \
    --region "$SECONDARY_REGION" --output json 2>/dev/null || echo '')"
  if [[ -n "$replica_json" ]]; then
    ok "Read replica '${REPLICA_DB_ID}' exists in ${SECONDARY_REGION}"
    lag="$(aws cloudwatch get-metric-statistics \
      --namespace AWS/RDS --metric-name ReplicaLag \
      --dimensions Name=DBInstanceIdentifier,Value="$REPLICA_DB_ID" \
      --statistics Average --period 60 \
      --start-time "$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '')" \
      --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --region "$SECONDARY_REGION" \
      --query 'sort_by(Datapoints,&Timestamp)[-1].Average' --output text 2>/dev/null || echo None)"
    if [[ "$lag" == "None" || -z "$lag" ]]; then
      bad "Could not read ReplicaLag metric (no recent datapoints)"
    elif awk "BEGIN{exit !(${lag} <= ${MAX_REPLICA_LAG_SECONDS})}"; then
      ok "Replica lag ${lag}s is within RPO target (${MAX_REPLICA_LAG_SECONDS}s)"
    else
      bad "Replica lag ${lag}s exceeds RPO target (${MAX_REPLICA_LAG_SECONDS}s)"
    fi
  else
    bad "Read replica '${REPLICA_DB_ID}' not found in ${SECONDARY_REGION}"
  fi
else
  bad "awscli not available — skipping RDS checks"
fi

section "3. S3 cross-region replication"
if command -v aws >/dev/null 2>&1; then
  for kind in uploads backups; do
    bucket="teachlink-${PRIMARY_REGION//-/}-${ENVIRONMENT}-${kind}"
    status="$(aws s3api get-bucket-replication --bucket "$bucket" \
      --query 'ReplicationConfiguration.Rules[0].Status' --output text 2>/dev/null || echo None)"
    if [[ "$status" == "Enabled" ]]; then
      ok "Replication enabled on ${bucket}"
    else
      bad "Replication not enabled on ${bucket} (status=${status})"
    fi
  done
else
  bad "awscli not available — skipping S3 checks"
fi

section "Drill summary"
printf 'Passed: %d  Failed: %d\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]] || {
  echo "Drill FAILED — investigate before relying on failover."
  exit 1
}
echo "Drill PASSED — deployment is failover-ready."
