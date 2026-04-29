# Database Failure Runbook

## Quick Reference

| Metric | Value |
|--------|-------|
| **Alert**: | DISASTER_RECOVERY_FAILED or DATABASE_CONNECTION_ERROR |
| **RTO**: | ≤ 15 minutes |
| **RPO**: | ≤ 7 days |
| **Escalation**: | On-call Engineer → Platform Lead (if RTO exceeded) |

---

## Symptoms & Detection

### Symptom 1: API Returns 500 Errors on All Database Queries

**Observable Indicators**:
```
GET /api/courses → 500 Internal Server Error
GET /api/users/me → 500 Internal Server Error
GET /health → "database": "down"
```

**Root Causes**:
- PostgreSQL process crashed
- Connection pool exhausted
- Network partition between app and database
- Out of disk space on database volume
- Authentication failure (incorrect credentials)

### Symptom 2: Health Check Fails

**Check health endpoint**:
```bash
curl -s http://api.teachlink.local/health | jq .
```

**Expected output on failure**:
```json
{
  "status": "unhealthy",
  "database": "down",
  "database_error": "connect ECONNREFUSED 10.0.1.5:5432",
  "timestamp": "2026-04-28T14:30:15.234Z"
}
```

### Symptom 3: Alerts in Monitoring

**PagerDuty alerts that trigger this runbook**:
- `DISASTER_RECOVERY_FAILED` (CRITICAL)
- `DATABASE_CONNECTION_ERROR` (CRITICAL)
- `DB_POOL_EXHAUSTED` (CRITICAL)
- `DISK_SPACE_CRITICAL_DB` (CRITICAL)

---

## Initial Assessment (< 2 minutes)

### Step 1: Confirm Database is Down

```bash
# SSH to bastion host
ssh ec2-user@bastion.teachlink.aws

# Attempt direct database connection
psql -h teachlink-primary-db.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d teachlink \
     -c "SELECT 1;"

# Expected response on failure:
# psql: error: could not translate host name "teachlink-primary-db..." to address: Name or service not known
# OR
# psql: error: could not connect to server: Connection refused
```

### Step 2: Check Database Status in AWS Console

```bash
# Get RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier teachlink-primary-db \
  --query 'DBInstances[0].[DBInstanceStatus,PendingModifiedValues]' \
  --output table
```

**Expected healthy status**: `available`

**Unhealthy statuses that need recovery**:
- `failed` — Failure detected; recovery needed
- `storage-full` — Out of disk space
- `incompatible-parameters` — Parameter change failed
- `rebooting` — Reboot in progress (wait 2-3 min, then retry)

### Step 3: Check Application Logs for Specific Error

```bash
# SSH to a pod
kubectl get pods -n production | grep api
kubectl logs -n production api-pod-abc123 -f --tail=50

# Look for errors like:
# Error: connect ECONNREFUSED (database crashed)
# Error: FATAL: remaining connection slots reserved
# Error: insufficient disk space (storage-full)
# Error: FATAL: password authentication failed (auth issue)
```

---

## Recovery Path: Choose Based on Root Cause

### Path A: Database Process Restarted/Service Recovered

**Timeline**: 2-3 minutes

**Check if database auto-recovered**:
```bash
# Retry connection after 30 seconds
psql -h teachlink-primary-db.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d teachlink \
     -c "SELECT now();"
```

**If successful**:
```
✅ Database recovered automatically
→ Skip to "Verification" section
```

---

### Path B: Database Instance Failed (Storage/CPU Issue)

**Timeline**: 5-8 minutes

**Step 1: Check CloudWatch metrics**

```bash
# Check available storage
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeableMemory \
  --dimensions Name=DBInstanceIdentifier,Value=teachlink-primary-db \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

**Step 2: If storage full (< 1 GB available)**

```bash
# Increase storage allocation
aws rds modify-db-instance \
  --db-instance-identifier teachlink-primary-db \
  --allocated-storage 300 \
  --apply-immediately

# Wait 2-3 minutes and retry connection
# Note: Database reboots during storage expansion
```

**Step 3: If out of memory or CPU**

```bash
# Check current instance class
aws rds describe-db-instances \
  --db-instance-identifier teachlink-primary-db \
  --query 'DBInstances[0].DBInstanceClass'

# Example: db.t3.large

# Upgrade instance (if in db.t3 class)
aws rds modify-db-instance \
  --db-instance-identifier teachlink-primary-db \
  --db-instance-class db.r5.large \
  --apply-immediately

# This causes ~2 minute reboot
# Wait for "available" status
```

**Expected recovery time**: 5-8 minutes total

---

### Path C: Restore from Latest Backup (Catastrophic Failure)

**Timeline**: 12-15 minutes

**Triggers this path if**:
- Database volume corrupted or unrecoverable
- Connection still fails after 2 minutes of Path B troubleshooting
- RTO timer has < 10 minutes remaining

**Step 1: Find latest verified backup**

```bash
# Query backup API for latest verified backup
curl -s "http://api.teachlink.local/backup?status=completed&integrityVerified=true&limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.backups[0]'

# Output example:
{
  "id": "backup-20260427-020000",
  "createdAt": "2026-04-27T02:00:00Z",
  "status": "completed",
  "integrityVerified": true,
  "dataSize": "47.3 GB",
  "checksum": "abc123def456..."
}
```

**Alternative: Query database directly**

```bash
# Connect to a working backup metadata DB or read from S3
aws s3 ls s3://teachlink-backups/backups/ | tail -5

# Most recent backup:
# s3://teachlink-backups/backups/backup-20260427-020000.sql.gz
```

**Step 2: Initiate restore**

```bash
# Call restore endpoint with latest backup ID
BACKUP_ID="backup-20260427-020000"

curl -X POST "http://api.teachlink.local/backup/restore/$BACKUP_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "targetDatabase": "teachlink",
    "verifyIntegrity": true,
    "createBackupFirst": true
  }'

# Response:
# {
#   "restoreRequestId": "restore-abc123",
#   "status": "in_progress",
#   "estimatedDuration": "8 minutes"
# }
```

**Step 3: Monitor restore progress**

```bash
# Check restore status
RESTORE_ID="restore-abc123"

curl -s "http://api.teachlink.local/backup/restore/$RESTORE_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.progress'

# Example output:
# {
#   "stage": "restoring",
#   "percent": 42,
#   "message": "Restoring 20 GB of 47 GB...",
#   "elapsed_seconds": 185,
#   "estimated_remaining_seconds": 245
# }
```

**Tail application logs** to watch for restore progress:

```bash
# In another terminal
kubectl logs -n production deployment/api -f --all-containers=true | grep -i restore

# Look for:
# "Starting disaster recovery restore for backup: backup-20260427-020000"
# "Downloading backup from secondary region"
# "Decrypting backup"
# "Restoring to primary database"
# "Disaster recovery completed. RTO: 487 seconds"
```

**Step 4: Verify restore completion**

Wait for restore to complete:
```bash
# Check final status
curl -s "http://api.teachlink.local/backup/restore/$RESTORE_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected response on success:
# {
#   "status": "completed",
#   "completedAt": "2026-04-28T14:38:00Z",
#   "rto_seconds": 487,
#   "dataIntegrityVerified": true,
#   "rowCount": {
#     "courses": 5432,
#     "users": 18943,
#     "assessments": 42156
#   }
# }
```

---

## Verification (< 3 minutes)

### Check 1: Health Endpoint

```bash
curl -s http://api.teachlink.local/health | jq .

# Expected response:
# {
#   "status": "healthy",
#   "database": "ok",
#   "redis": "ok",
#   "uptime_seconds": 1200
# }
```

### Check 2: Database Connectivity

```bash
# Run smoke test query through API
curl -s http://api.teachlink.local/api/courses?limit=1 \
  -H "Authorization: Bearer $TEST_USER_TOKEN" | jq '.courses | length'

# Expected: 1 (or more)
```

### Check 3: Critical Queries

```bash
# Test high-impact endpoints
for endpoint in /api/users/me /api/courses /api/assessments; do
  echo "Testing $endpoint..."
  curl -s "http://api.teachlink.local$endpoint" \
    -H "Authorization: Bearer $TEST_USER_TOKEN" \
    -w "\n✓ HTTP %{http_code}\n"
done
```

### Check 4: Monitoring Dashboard

```
Open: https://monitoring.teachlink.local
Look for:
  ✓ Database (PostgreSQL) → green
  ✓ Error rate (5min) → < 0.1%
  ✓ API latency (p99) → < 200ms
  ✓ Cache hit rate → > 85%
```

### Check 5: Data Integrity

```bash
# If restore was performed, verify record counts
curl -s "http://api.teachlink.local/admin/data-integrity-check" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.results'

# Check for:
# {
#   "users": { "count": 18943, "status": "ok" },
#   "courses": { "count": 5432, "status": "ok" },
#   "assessments": { "count": 42156, "status": "ok" },
#   "deleted_at_nulls": { "count": 0, "status": "ok" }
# }
```

---

## When Recovery Fails

### Troubleshooting if Health Check Still Fails

**Issue: Connection still refused after 10 minutes**

**Diagnosis**:
```bash
# Check if database process is running
aws rds describe-db-instances \
  --db-instance-identifier teachlink-primary-db \
  --query 'DBInstances[0].DBInstanceStatus'

# If not "available", check what's happening:
# - rebooting (normal; wait 2-3 min)
# - failed (go to Step 2 below)
# - storage-full (go to Path B above)
```

**Recovery Step 1: Force reboot**

```bash
aws rds reboot-db-instance \
  --db-instance-identifier teachlink-primary-db \
  --force

# Wait 2-3 minutes, then retry health check
# Expected recovery time: 3 minutes
```

**Recovery Step 2: Restore from snapshot (if reboot fails)**

```bash
# List recent snapshots
aws rds describe-db-snapshots \
  --query 'DBSnapshots[?DBInstanceIdentifier==`teachlink-primary-db`].DBSnapshotIdentifier' \
  --output table

# Restore from most recent
SNAPSHOT_ID="rds:teachlink-primary-db-latest"

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier teachlink-primary-db-restored \
  --db-snapshot-identifier $SNAPSHOT_ID

# This creates a new instance; update connection string in app config
# Or rename: aws rds modify-db-instance --new-db-instance-identifier teachlink-primary-db
```

**Recovery Step 3: Escalate to AWS Support (if still failing)**

If database doesn't recover after 12 minutes:

```bash
# Open AWS Support case
aws support create-case \
  --subject "TeachLink RDS database not recovering" \
  --service-code amazon-rds \
  --severity-code urgent \
  --communication-body "Database teachlink-primary-db not accessible after 12+ minutes. Reboot failed. Requesting immediate remediation."

# Contact: AWS Support Console → Open Case
```

---

## Post-Recovery Actions (< 15 minutes)

### 1. Resume Scheduled Tasks

If restore was performed, some cron tasks may have been missed:

```bash
# Check for any missed backup runs
curl -s "http://api.teachlink.local/admin/backup/schedule-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.next_scheduled_run'

# If backup is due within 1 hour, manually trigger it now:
curl -X POST "http://api.teachlink.local/backup/create" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"type": "full", "reason": "post-recovery-verification"}'
```

### 2. Clear Cache If Necessary

If strange data behavior noticed post-recovery:

```bash
# SSH to Redis pod
kubectl get pods -n production -l app=redis
kubectl exec -it redis-pod-abc123 -c redis -- redis-cli

# Inside Redis CLI:
> FLUSHDB  # Clear current database
> FLUSHALL # Clear all databases

# Expected output: OK
```

### 3. Communicate Status

Send updates to stakeholders:

```
Slack #incidents:
✅ Database failure resolved
   RTO: <actual-time> minutes (target: ≤ 15)
   RPO: 7 days (latest backup used)
   Status: All health checks passing
   Next: Post-incident review at [time]
```

### 4. Create Post-Incident Report

Schedule review within 24 hours:

```
Include:
- [ ] Timeline of failure and recovery
- [ ] Root cause analysis
- [ ] Preventive measures to avoid recurrence
- [ ] Lessons learned
```

---

## Escalation

### When to Escalate (Trigger Points)

| Condition | Action | Contact |
|-----------|--------|---------|
| RTO exceeded (> 15 min) | Escalate immediately | Platform Lead, CTO |
| Restore still failing (> 12 min) | Call AWS Support | +1-206-555-0100 (AWS Support) |
| Data integrity issues post-recovery | Escalate to CTO | Schedule urgent meeting |
| Multiple database failures in 24 hours | Escalate to infrastructure | Plan capacity increase |

### Escalation Contacts

```
On-Call Engineer: PagerDuty (on-call rotation)
Platform Lead: Slack @platform-lead or email platform@teachlink.local
CTO: Email cto@teachlink.local or escalation phone
AWS Support: https://console.aws.amazon.com/support
```

---

## Appendix: Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Database process down | Reboot RDS instance |
| `FATAL: password authentication failed` | Auth credentials wrong | Check AWS Secrets Manager (DB_PASSWORD) |
| `FATAL: too many connections` | Pool exhausted | Restart application pods |
| `ERROR: relation "users" does not exist` | Schema corruption | Restore from backup |
| `disk space low` | Storage at 90%+ | Extend EBS volume or clean old logs |

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-28  
**Owner**: Platform Engineering / Database Team  
**Review Schedule**: Quarterly

---

## Quick Links

- [Failover Plan](../procedures/failover-plan.md)
- [RTO/RPO Definitions](../procedures/RTO-RPO.md)
- [Region Outage Runbook](./region-outage.md)
- [Backup Strategy](../../docs/backup-strategy.md)
