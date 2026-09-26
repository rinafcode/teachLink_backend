# Backup Policy

This document governs how backups of the TeachLink Backend data plane are
taken, how often they are verified, and how long they are kept. It exists so
that contributors and maintainers have a single, versioned reference for the
backup posture: when backups run, when they are restored-testable, and what
the retention contract is.

This policy is part of the project's **Security & disclosure** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Scope

This policy covers every backup artifact produced by the service:

- **Database backups** — full and incremental snapshots of the primary
  database, produced by the backup subsystem under `src/backup/` (including
  `BackupProcessingWorker` in `src/workers/processors/backup-processing.worker.ts`).
- **File/artifact backups** — any secondary storage snapshot or replica
  referenced by the `.env` `ENABLE_BACKUP` flag and the secondary S3 bucket
  used for backups/replicas.
- **Backup metadata and logs** — the records describing each run, its
  outcome, and any restore performed.

Backups taken ad hoc outside the backup subsystem (for example, a maintainer's
manual `pg_dump` for debugging) are out of scope for the cadence and
retention rules below but must still respect the access and encryption rules
in this document.

## Backup Frequency

- **Full backups** run **daily**, produced by the scheduled backup job. The
  exact time is chosen to avoid contending with peak traffic and with other
  scheduled work (see `Governance/domains/CRON_GOVERNANCE.md`).
- **Incremental backups** run **hourly**, capturing changes since the last full
  or incremental backup, so that the Recovery Point Objective (RPO) for the
  data plane is one hour.
- **Differential backups** are supported by the backup worker for environments
  that prefer a shorter restore chain; they are optional and, where used,
  are taken on the same schedule as incrementals.
- Backups are **enabled by default** (`ENABLE_BACKUP=true` in
  `.env.example`, `.env.staging`, and production). A deployment that disables
  backups must record an explicit, reviewed exception in the decision log and
  accept the corresponding RPO loss.

## Restore-Test Cadence

- **Quarterly.** A full restore of the most recent full backup plus its
  dependent incrementals is performed into a staging environment, and the
  application is verified healthy against it. The result (date, scope, any
  anomalies) is recorded in the backup run log.
- **After every production restore.** Any restore performed to recover from an
  incident is itself reviewed as part of the incident postmortem
  (`Governance/domains/POSTMORTEM_POLICY.md`), including whether the backup
  used was complete and consistent.
- **On backup failure.** A failed backup run triggers a restore test of the
  most recent known-good backup within 24 hours, to confirm that the previous
  backups are still restorable and that the failure was in the capture, not
  in the stored artifacts.

A restore test that cannot be performed (no staging environment, no backup
available) is itself an incident and is escalated through
`src/incident-management/`.

## Retention of Backups

- **Full backups** are retained for **30 days**.
- **Incremental backups** are retained for **7 days**, and are only useful in
  combination with the retained full backup they follow.
- **Backup metadata and logs** are retained for **90 days**, matching the
  audit-log retention period (`Governance/domains/LOGGING_RETENTION.md`), so
  that backup and audit history stay in sync.
- Retention is enforced by the backup subsystem's purge task; backups whose
  retention window has passed are deleted, and the deletion is itself logged.
- Extending retention beyond these defaults requires a stated reason (a legal
  hold, an active investigation) and is time-boxed, not a silent permanent
  increase.

## Encryption and Access

- Backups at rest are encrypted with the project's storage encryption key; the
  secondary S3 bucket referenced for backups/replicas must enforce
  server-side encryption and restrict read access to the backup service and
  on-call maintainers.
- Backup artifacts must not contain unredacted secrets or credentials. Any
  configuration captured in a backup is encrypted or redacted before leaving
  the primary store.
- Access to backups is audited: every restore or export of a backup artifact
  is recorded in the audit log.

## Regression Tests

The backup policy is enforced by code, and the code is covered by tests:

- Unit tests for the backup worker's scheduling, idempotency, and purge
  behavior (see `backup-processing.worker.spec.ts`).
- Tests confirming that a failed backup run is surfaced and that the
  restore-test trigger fires for known-good backups.
- These tests are part of the project's normal test suite; a change to backup
  behavior must update or add coverage here.

## Review

This policy is reviewed at least once a year, or whenever the backup
mechanism, retention defaults, or restore process changes materially.
Changes are proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.