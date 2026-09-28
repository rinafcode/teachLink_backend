# Disaster Recovery Plan

## Overview

This document defines the disaster recovery (DR) procedures for the TeachLink backend platform. It covers recovery objectives, recovery procedures, runbooks, and responsibilities.

---

## Recovery Objectives

| Metric                             | Target                        |
| ---------------------------------- | ----------------------------- |
| **RTO** (Recovery Time Objective)  | ≤ 15 minutes                  |
| **RPO** (Recovery Point Objective) | ≤ 7 days (weekly full backup) |

The system alerts automatically when a recovery exceeds the RTO threshold (`DISASTER_RECOVERY_RTO_EXCEEDED` alert, `CRITICAL` severity).

---

## Architecture Overview

```
Primary Region (us-east-1)          Secondary Region (us-west-2)
┌───────────────────────┐           ┌──────────────────────────┐
│  PostgreSQL DB        │──backup──▶│  S3 Replicated Storage   │
│  NestJS API           │           │  (cross-region copy)     │
│  Redis Cache          │           └──────────────────────────┘
└───────────────────────┘
         │
         ▼
   AWS S3 (primary)
   AWS KMS (encryption)
```

Backups are encrypted with AWS KMS before upload to S3 and replicated to the secondary region storage key.

---

## Backup Sources

| Component      | Backup Method                 | Schedule               | Retention                                       |
| -------------- | ----------------------------- | ---------------------- | ----------------------------------------------- |
| PostgreSQL     | `pg_dump` (full)              | Every Sunday 02:00 UTC | 30 days (configurable: `BACKUP_RETENTION_DAYS`) |
| Backup records | PostgreSQL (self-referential) | Same as above          | 30 days                                         |

---

## Disaster Scenarios

### Scenario 1 — Primary Database Failure

**Symptoms:** API returns 500 errors on all DB-dependent endpoints; health checks fail on database.

**Response steps:**

1. Trigger `POST /backup/restore/:backupId` with the latest verified backup ID.
2. The `DisasterRecoveryService` will:
   - Retrieve the latest integrity-verified backup from the repository.
   - Download the backup from the secondary-region S3 key (`replicatedStorageKey`).
   - Decrypt the data with AWS KMS (`DecryptCommand`).
   - Run `pg_restore` against the primary database.
3. Verify recovery by checking health endpoint: `GET /health`.
4. Monitor the `DISASTER_RECOVERY_SUCCESS` or `DISASTER_RECOVERY_FAILED` alerts.

### Scenario 2 — Primary Region Outage

**Symptoms:** All services unreachable; AWS Console shows regional incident.

**Response steps:**

1. Update DNS / load balancer to point to standby deployment in `us-west-2`.
2. Provision a new database instance in `us-west-2`.
3. Trigger restore using backup from `us-west-2` S3 bucket (`BACKUP_SECONDARY_REGION=us-west-2`).
4. Update environment variables (`DB_HOST`, `AWS_REGION`) and redeploy.
5. Confirm all scheduled tasks (weekly backup, cleanup) resume after restart.

### Scenario 3 — Corrupted/Compromised Data

**Symptoms:** Data inconsistency detected; integrity check failures.

**Response steps:**

1. Identify the last known-good backup (integrity-verified, before the incident).
2. Create a new empty database to avoid overwriting.
3. Restore to the new database and validate.
4. Swap connection string once validated.

---

## Recovery Runbook

### Prerequisites

Ensure the following environment variables are set on the recovery host:

```env
DB_HOST=<target-db-host>
DB_PORT=5432
DB_DATABASE=teachlink
DB_USERNAME=<db-user>
DB_PASSWORD=<db-password>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
BACKUP_PRIMARY_REGION=us-east-1
BACKUP_SECONDARY_REGION=us-west-2
```

### Step-by-Step Restore

```bash
# 1. Identify the latest verified backup via API
GET /backup?status=completed&integrityVerified=true

# 2. Initiate restore
POST /backup/restore/:backupId

# 3. Monitor logs for recovery progress
# Expected log events:
#   - "Starting disaster recovery restore for backup: <id>"
#   - "Downloading backup from secondary region"
#   - "Decrypting backup"
#   - "Restoring to primary database"
#   - "Disaster recovery completed. RTO: <N> seconds"

# 4. Validate health
GET /health
```

### Automated Alerts

| Alert Key                        | Severity | Meaning                                       |
| -------------------------------- | -------- | --------------------------------------------- |
| `DISASTER_RECOVERY_SUCCESS`      | INFO     | Recovery completed within RTO                 |
| `DISASTER_RECOVERY_RTO_EXCEEDED` | CRITICAL | Recovery took > 15 minutes                    |
| `DISASTER_RECOVERY_FAILED`       | CRITICAL | Recovery failed; manual intervention required |
| `BACKUP_COMPLETED`               | INFO     | Scheduled backup succeeded                    |
| `BACKUP_FAILED`                  | CRITICAL | Scheduled backup failed                       |
| `BACKUP_SCHEDULED_FAILED`        | CRITICAL | All retry attempts exhausted                  |

---

## Testing the DR Plan

Recovery tests should be run in a staging environment. The `RecoveryTest` entity tracks test results.

**Monthly drill checklist:**

- [ ] Trigger a manual backup and verify integrity.
- [ ] Execute restore to a staging database.
- [ ] Confirm RTO is within the 15-minute target.
- [ ] Verify all application health checks pass post-restore.
- [ ] Review and update this document if procedures have changed.

---

## Contacts and Escalation

| Role             | Responsibility                      |
| ---------------- | ----------------------------------- |
| On-call Engineer | First responder; execute runbook    |
| Platform Lead    | Escalation for region-level outages |
| AWS Support      | Infrastructure-level issues         |

---

## Related Documents

- [Backup Strategy](./backup-strategy.md)
- [Monitoring Dashboard](./monitoring-dashboard.md)
- [Migrations Guide](./migrations.md)
