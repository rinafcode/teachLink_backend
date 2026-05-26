# Data Corruption Runbook

## Quick Reference

| Metric | Value |
|--------|-------|
| **Alert**: | DATA_INTEGRITY_CHECK_FAILED or BACKUP_CORRUPTION_DETECTED |
| **RTO**: | ≤ 15 minutes (to degraded mode) |
| **RPO**: | ≤ 7 days (to last known-good backup) |
| **Escalation**: | On-call Engineer → CTO (requires approval for data restore) |

---

## Symptoms & Detection

### Symptom 1: Data Integrity Alerts

**PagerDuty Alerts**:
- `DATA_INTEGRITY_CHECK_FAILED` (CRITICAL)
- `BACKUP_CORRUPTION_DETECTED` (CRITICAL)
- `ORPHANED_RECORDS_DETECTED` (CRITICAL)
- `FOREIGN_KEY_CONSTRAINT_VIOLATION` (CRITICAL)

**System Logs**:
```
ERROR: [IntegrityCheckService] Foreign key constraint violation detected
  Table: assessments
  ViolatedKey: course_id=999999 (no matching course record)
  Count: 127 orphaned records

ERROR: [DataValidation] Checksum mismatch in course: 12345
  Expected: abc123def456...
  Actual:   xyz789uvw012...
  Status: CORRUPTED
```

### Symptom 2: Application Anomalies

**Observable Issues**:
```
GET /api/courses/{id} → 200 OK, but course.name = NULL
GET /api/users/{id} → 500 error (constraint violation on update)
POST /api/assignments → Partial save (some fields missing)
Dashboard shows 0 courses (data invisible but not deleted)
```

**Root Causes**:
1. Failed database migration (partial schema update)
2. Corrupted backup file (compression error, transmission failure)
3. Hardware failure on database volume (bit flip)
4. Application bug causing invalid updates
5. Manual SQL mistakes by operator
6. Network packet loss during data transfer

### Symptom 3: Failed Backup Integrity Check

```bash
# During backup verification
curl -s "https://api.teachlink.local/backup/{id}/verify" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
{
  "status": "integrity_check_failed",
  "reason": "Checksum mismatch",
  "expected_checksum": "abc123...",
  "actual_checksum": "xyz789...",
  "corrupted_tables": ["courses", "assessments", "users"]
}
```

---

## Initial Assessment (< 2 minutes)

### Step 1: Confirm Data Corruption

```bash
# Run comprehensive integrity check
curl -X POST "https://api.teachlink.local/admin/data-integrity-check" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"full_check": true, "check_referential_integrity": true}'

# Wait for check to complete (~2 minutes for 50GB)
curl -s "https://api.teachlink.local/admin/data-integrity-check/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.results'

# Example failing output:
{
  "overall_status": "FAILED",
  "errors": [
    {
      "type": "foreign_key_violation",
      "table": "assessments",
      "count": 127,
      "sample_ids": [12345, 12346, 12347]
    },
    {
      "type": "null_constraint_violation",
      "table": "courses",
      "column": "name",
      "count": 34
    }
  ]
}
```

### Step 2: Assess Scope & Severity

```bash
# Determine what percentage of data is corrupted
curl -s "https://api.teachlink.local/admin/data-integrity-check/summary" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'

# Example output:
{
  "total_records": 1000000,
  "corrupted_records": 2500,
  "corruption_percentage": 0.25,
  "affected_tables": ["assessments", "courses"],
  "affected_users": 150
}
```

**Decision Matrix**:

| Corruption % | Scope | Action |
|----------|-------|--------|
| < 0.1% | Isolated records | Repair in-place (Step 2) |
| 0.1% - 1% | Multiple tables | Restore to point-in-time (Step 3) |
| 1% - 10% | Major tables | Restore from backup (Step 4) |
| > 10% | Catastrophic | Enterprise backup + legal review |

### Step 3: Identify Last Known-Good State

```bash
# Check backup integrity history
curl -s "https://api.teachlink.local/backup?limit=10&sort=created_desc" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | {id, created_at, integrity_verified, checksum}'

# Example:
[
  {
    "id": "backup-20260427-020000",
    "created_at": "2026-04-27T02:00:00Z",
    "integrity_verified": true,
    "checksum": "abc123def456..."
  },
  {
    "id": "backup-20260426-020000",
    "created_at": "2026-04-26T02:00:00Z",
    "integrity_verified": true,
    "checksum": "def456ghi789..."
  }
]

# Assume corruption occurred between backups
# Latest integrity-verified backup is "safe" to restore to
```

---

## Recovery Path: Choose Based on Severity

### Path A: Isolated Corruption (< 0.1%)

**Timeline**: 5-10 minutes

**Use when**: Only a few records corrupted; can repair in-place

**Step 1: Repair corrupted records**

```bash
# For foreign key violations: delete orphaned records
curl -X POST "https://api.teachlink.local/admin/repair/delete-orphaned-records" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "table": "assessments",
    "foreign_key_constraint": "course_id",
    "dry_run": true
  }'

# Expected output:
# {
#   "dry_run": true,
#   "records_to_delete": 127,
#   "sample_ids": [12345, 12346, 12347]
# }

# If sample ids look correct, execute:
curl -X POST "https://api.teachlink.local/admin/repair/delete-orphaned-records" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "table": "assessments",
    "foreign_key_constraint": "course_id",
    "dry_run": false
  }'
```

**Step 2: Repair NULL constraints**

```bash
# For NULL constraint violations: restore defaults or delete
curl -X POST "https://api.teachlink.local/admin/repair/fix-null-constraints" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "table": "courses",
    "column": "name",
    "action": "set_default",
    "default_value": "Unnamed Course",
    "dry_run": false
  }'
```

**Step 3: Re-run integrity check**

```bash
curl -X POST "https://api.teachlink.local/admin/data-integrity-check" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify status: "PASSED"
```

**RTO**: ~10 minutes  
**Data Loss**: None (repairs in-place)

---

### Path B: Multiple Tables Corrupted (0.1% - 1%)

**Timeline**: 10-15 minutes

**Use when**: Multiple tables affected, but can use point-in-time recovery

**Step 1: Find corruption start time**

```bash
# Query transaction logs to identify when corruption started
curl -s "https://api.teachlink.local/admin/transaction-logs" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"action": "identify_anomaly", "hours_back": 24}'

# Example output:
# {
#   "corruption_detected_at": "2026-04-28T11:35:00Z",
#   "anomaly_type": "failed_migration",
#   "affected_queries": 45,
#   "recovery_options": [
#     "point_in_time_20260428_110000",
#     "point_in_time_20260428_103000"
#   ]
# }

# Choose recovery point 15 minutes BEFORE corruption started
# Example: Recover to 2026-04-28T11:20:00Z (before 11:35)
```

**Step 2: Initiate point-in-time recovery**

```bash
# Restore to specific timestamp
curl -X POST "https://api.teachlink.local/backup/restore-point-in-time" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "target_timestamp": "2026-04-28T11:20:00Z",
    "target_database": "teachlink",
    "verify_integrity": true
  }'

# Monitor progress
curl -s "https://api.teachlink.local/backup/restore-point-in-time/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected output while in progress:
# {
#   "status": "in_progress",
#   "stage": "recovering_to_timestamp",
#   "percent": 45,
#   "elapsed_seconds": 120,
#   "estimated_remaining_seconds": 200
# }
```

**Step 3: Validate recovered data**

```bash
# Re-run integrity check
curl -X POST "https://api.teachlink.local/admin/data-integrity-check" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify status: "PASSED"

# Count data loss
curl -s "https://api.teachlink.local/admin/data-integrity-check/comparison" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"recovery_point": "2026-04-28T11:20:00Z"}'

# Expected output:
# {
#   "records_recovered": 998500,
#   "records_lost_since_recovery_point": 1500,
#   "recovery_point_age": "17 minutes"
# }
```

**RTO**: ~12 minutes (PITR to backup)  
**RPO**: ~20 minutes (data since recovery point lost)

---

### Path C: Major Corruption (1% - 10%)

**Timeline**: 12-15 minutes

**Use when**: Multiple critical tables corrupted; must restore from full backup

**Step 1: Choose backup to restore from**

```bash
# List recent backups with integrity status
curl -s "https://api.teachlink.local/backup?limit=20&sort=created_desc" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq '.[] | select(.integrity_verified == true) | {id, created_at, data_size, corruption_check: "PASSED"}'

# Choose most recent integrity-verified backup
# Example: backup-20260427-020000 (yesterday's backup, 7 days RPO)
```

**Step 2: Get stakeholder approval**

```
⚠️  CRITICAL DECISION POINT ⚠️

Restoring from backup means:
- Data since backup time will be LOST (up to 7 days)
- Current transactions in progress will be ROLLED BACK
- Users may need to re-do work since last backup

Decision Required: CTO or VP Eng must approve

Notify:
  CTO: "Corrupted 1-10% of data. Must restore 7-day-old backup. Approve? [Y/N]"
```

**Step 3: Prepare for restore**

```bash
# Create backup of corrupted state (for forensics)
aws rds create-db-snapshot \
  --db-instance-identifier teachlink-primary-db \
  --db-snapshot-identifier teachlink-corrupted-state-20260428

# This snapshot preserved for post-incident analysis
```

**Step 4: Execute full restore**

```bash
# Restore from backup-20260427-020000
curl -X POST "https://api.teachlink.local/backup/restore/backup-20260427-020000" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "targetDatabase": "teachlink",
    "verifyIntegrity": true,
    "createBackupFirst": true
  }'

# Monitor restore progress
for i in {1..180}; do
  progress=$(curl -s "https://api.teachlink.local/backup/restore/status" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.percent')
  echo "Restore progress: $progress% (attempt $i/180)"
  
  if [ "$progress" == "100" ]; then
    echo "Restore complete!"
    break
  fi
  sleep 5
done
```

**Step 5: Validate restoration**

```bash
# Run full integrity check
curl -X POST "https://api.teachlink.local/admin/data-integrity-check" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"full_check": true}'

# Expected output:
# {
#   "overall_status": "PASSED",
#   "total_records_checked": 1000000,
#   "errors": []
# }

# Verify service is operational
curl -s https://api.teachlink.local/health | jq '.status'
# Expected: "healthy"
```

**RTO**: ~15 minutes  
**RPO**: 7 days (data between backup and corruption lost)

---

## Preventive Validation

### Post-Restoration Verification Checklist

```
After ANY data recovery (Steps A, B, or C), verify:

✓ Health endpoint returns "healthy"
✓ Integrity check shows "PASSED"
✓ All critical tables have correct record counts
✓ Spot-check: Random 10 records from each table
✓ User-facing features work: courses load, assessments display
✓ API response times normal (< 200ms p99)
✓ No new errors in logs
✓ Backup system is functioning (next backup scheduled)
```

### Data Loss Notification

If data recovery results in data loss:

```bash
# Identify affected users
curl -s "https://api.teachlink.local/admin/data-recovery/affected-users" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Send notifications
curl -X POST "https://api.teachlink.local/admin/notify/data-recovery" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "affected_user_ids": [1001, 1002, 1003],
    "subject": "Data Recovery Notice",
    "message": "Your recent changes were lost due to a system recovery. We apologize for any inconvenience.",
    "support_url": "https://support.teachlink.local/data-recovery-2026-04-28"
  }'
```

---

## Preventing Corruption Recurrence

### Root Cause Analysis

**Ask these questions**:

1. **Was this a backup corruption?**
   ```
   ✓ Check backup transfer logs
   ✓ Verify checksums during transfer
   ✓ Increase backup redundancy (multiple copies in different regions)
   ```

2. **Was this a migration failure?**
   ```
   ✓ Review migration script (what query caused corruption?)
   ✓ Implement pre-migration integrity check
   ✓ Add post-migration validation
   ✓ Test migrations on staging first
   ```

3. **Was this application-induced corruption?**
   ```
   ✓ Review application logs for time of corruption
   ✓ Find the API call/transaction that corrupted data
   ✓ Add input validation
   ✓ Implement audit trail of updates
   ✓ Use transactions with rollback on error
   ```

4. **Was this hardware-related?**
   ```
   ✓ Check CloudWatch for disk errors
   ✓ Request AWS diagnostics
   ✓ Consider upgrading to higher durability tier
   ✓ Implement redundant storage
   ```

### Improvements to Prevent Recurrence

**Short-term (Immediate - 1 week)**:
```
✓ Run full integrity checks daily (not just scheduled backups)
✓ Add monitoring alert for corruption patterns
✓ Implement read-only replica for backup verification
✓ Document corruption incident in wiki
```

**Medium-term (Planned - 1 month)**:
```
✓ Automate pre-migration integrity checks
✓ Implement point-in-time recovery capability
✓ Add application-level audit trail
✓ Increase backup frequency from weekly to daily
```

**Long-term (Roadmap - Q3 2026)**:
```
✓ Implement transaction-level disaster recovery
✓ Add full-database replication (synchronous)
✓ Implement automated compliance scanning
✓ Deploy immutable backup snapshots
```

---

## Escalation & Communication

### When to Escalate

| Condition | Action | Contact |
|-----------|--------|---------|
| Corruption > 1% | Immediate CTO approval | Page CTO |
| Data loss likely | Legal review required | Contact legal@teachlink.local |
| Customer data affected | Customer notification required | Notify customers within 24h |
| Affects multiple regions | Enterprise backup required | AWS Enterprise Support |

### Stakeholder Notification

**Timeline for communications**:

| Time | Audience | Message | Method |
|------|----------|---------|--------|
| Immediate | Internal | Data corruption detected; assessing scope | #incidents |
| +5 min | Engineering | Initiating recovery procedure [Path A/B/C] | #incidents |
| +10 min | Executives | RTO target: 15 minutes; data loss: [X days] | email |
| +15 min | Customers* | Service may have data integrity issue; investigating | statuspage.io |
| +60 min | All | Recovery complete; details in post-incident report | statuspage.io + email |

*Only notify customers if corruption affects customer data or visible features.

---

## Appendix: Common Data Corruption Patterns

| Pattern | Cause | Solution |
|---------|-------|----------|
| All dates NULL in table | Migration set wrong default | Restore from backup or set defaults |
| Foreign key violations | Deleted parent without cascading | Delete orphaned children |
| Duplicated records | Failed uniqueness constraint | Identify & delete duplicates |
| Checksums mismatched | Backup corruption in transfer | Re-download from S3 / restore |
| Negative balances | Integer overflow or business logic bug | Reverse transaction + fix code |
| Missing recent data | Backup taken during crash | Restore and add recovered logs |

---

## References

- [Database Failure Runbook](./database-failure.md)
- [Failover Plan](../procedures/failover-plan.md)
- [Backup Strategy](../../docs/backup-strategy.md)
- [Input Validation Coverage](../../docs/input-validation-coverage.md)

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-28  
**Owner**: Platform Engineering / Database Team  
**Review Schedule**: Quarterly

---

## Quick Links

- [RTO/RPO Definitions](../procedures/RTO-RPO.md)
- [Database Failure Runbook](./database-failure.md)
- [Region Outage Runbook](./region-outage.md)
- [Backup Strategy](../../docs/backup-strategy.md)
