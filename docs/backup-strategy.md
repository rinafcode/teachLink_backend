# Backup Strategy

## Overview

This document describes the backup configuration, schedule, storage architecture, and operational procedures for the TeachLink backend platform.

---

## Backup Schedule

| Job Name                  | Cron        | UTC Time     | Description                                     |
| ------------------------- | ----------- | ------------ | ----------------------------------------------- |
| `weekly-database-backup`  | `0 2 * * 0` | Sunday 02:00 | Full PostgreSQL database backup                 |
| `cleanup-expired-backups` | `0 3 * * *` | Daily 03:00  | Deletes backups older than the retention window |

---

## Backup Types

| Type   | Description                               |
| ------ | ----------------------------------------- |
| `full` | Complete `pg_dump` of the entire database |

Additional backup types (incremental, differential) can be added to the `BackupType` enum as requirements evolve.

---

## Retention Policy

- **Default retention:** 30 days
- **Configuration:** `BACKUP_RETENTION_DAYS` environment variable
- Expired backups are identified by `createdAt < NOW() - retention_days` and status `COMPLETED`.
- Deletion is queued via Bull (`DELETE_BACKUP` job) with 3 retry attempts and exponential backoff (5 s initial delay).

---

## Storage Architecture

```
PostgreSQL (primary)
       │
       ▼
  pg_dump → encrypted with AWS KMS
       │
       ├──▶ S3 (primary region, us-east-1)   [encryptedStorageKey]
       │
       └──▶ S3 (secondary region, us-west-2) [replicatedStorageKey]
```

### Environment Variables

| Variable                | Default     | Description                      |
| ----------------------- | ----------- | -------------------------------- |
| `BACKUP_PRIMARY_REGION` | `us-east-1` | Primary S3 region                |
| `BACKUP_RETENTION_DAYS` | `30`        | Days to retain completed backups |
| `DB_DATABASE`           | `teachlink` | Database name to back up         |

---

## Encryption

All backups are encrypted using AWS KMS before being stored in S3.

- KMS key ID is stored on the `BackupRecord` (`kmsKeyId` column).
- Decryption uses `@aws-sdk/client-kms` `DecryptCommand` during restore.
- KMS configuration is provided via `AWS_REGION` and IAM role/credentials.

---

## Integrity Verification

After each backup completes, an integrity verification job is queued:

- MD5 and SHA-256 checksums are computed and stored (`checksumMd5`, `checksumSha256` columns).
- `integrityVerified` flag is set to `true` on success.
- Only backups with `integrityVerified = true` are eligible for disaster recovery restore.
- Verification timestamp is recorded in `verifiedAt`.

---

## Backup Record Schema

Each backup is tracked in the `backup_records` table:

| Column                 | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `id`                   | UUID primary key                                         |
| `backupType`           | `full`                                                   |
| `status`               | `pending` → `in_progress` → `completed` / `failed`       |
| `region`               | AWS region where the primary copy resides                |
| `databaseName`         | Name of the PostgreSQL database                          |
| `storageKey`           | Raw (pre-encryption) S3 key                              |
| `encryptedStorageKey`  | Encrypted backup S3 key                                  |
| `replicatedStorageKey` | Cross-region replica S3 key                              |
| `kmsKeyId`             | KMS key used for encryption                              |
| `backupSizeBytes`      | Backup file size                                         |
| `checksumMd5`          | MD5 of backup file                                       |
| `checksumSha256`       | SHA-256 of backup file                                   |
| `integrityVerified`    | Whether integrity check passed                           |
| `verifiedAt`           | Timestamp of last integrity verification                 |
| `expiresAt`            | Timestamp after which the record is eligible for cleanup |
| `errorMessage`         | Last error (if `status = failed`)                        |
| `retryCount`           | Number of retry attempts                                 |
| `metadata`             | JSON: pg version, table counts, total rows, timings      |
| `createdAt`            | Record creation time                                     |
| `completedAt`          | Time backup completed                                    |

---

## Scheduled Task Resilience

Both scheduled jobs are wrapped in the `ScheduledTaskMonitoringService`, which provides:

- **Configurable retries:** `BACKUP_SCHEDULED_TASK_RETRY_LIMIT` (default: 2)
- **Retry delay:** `BACKUP_SCHEDULED_TASK_RETRY_DELAY_MS` (default: 10,000 ms)
- **Timeout:** `BACKUP_SCHEDULED_TASK_TIMEOUT_MS` (default: 30 minutes)
- **Alerting on exhausted retries:** `BACKUP_SCHEDULED_FAILED` → `CRITICAL`

---

## Alerting

| Alert Key                 | Severity | Trigger                              |
| ------------------------- | -------- | ------------------------------------ |
| `BACKUP_COMPLETED`        | INFO     | Backup completed successfully        |
| `BACKUP_FAILED`           | CRITICAL | Backup job failed                    |
| `BACKUP_SCHEDULED_FAILED` | CRITICAL | All scheduled task retries exhausted |

---

## Operational Procedures

### Trigger a Manual Backup

```bash
POST /backup
```

### List Backups

```bash
GET /backup?status=completed&integrityVerified=true
```

### Check Backup Status

```bash
GET /backup/:id
```

### Restore from Backup

See [Disaster Recovery Plan](./disaster-recovery.md) for full restore runbook.

---

## Related Documents

- [Disaster Recovery Plan](./disaster-recovery.md)
- [Monitoring Dashboard](./monitoring-dashboard.md)
