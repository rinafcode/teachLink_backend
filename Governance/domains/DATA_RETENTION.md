# Data Retention Policy

**Domain:** Data Governance  
**Status:** Active  
**Last reviewed:** 2026-09-27  
**Owner:** Platform Engineering / Legal & Compliance

---

## Overview

This document defines how long TeachLink retains each category of user and system data, how that data is deleted or archived, and when normal deletion rules are suspended due to a legal hold. It applies to all environments (development, staging, production) and to every team member or process that creates, reads, modifies, or deletes TeachLink data.

---

## Retention Periods by Data Type

Retention periods represent the maximum time data is kept in its primary, queryable form before it is purged or moved to cold archive storage. Periods are configurable via environment variables (see `src/config/retention.config.ts`); the values below are the production defaults.

| Data type | Default retention | Env variable | Notes |
|-----------|:-----------------:|--------------|-------|
| **User profiles** (active) | Lifetime of account | — | Retained for the full lifetime of an active account |
| **User profiles** (soft-deleted) | 30 days | `RETENTION_SOFT_DELETE_DAYS` | Hard-deleted after the window; see §Deletion Process |
| **Courses & content** (active) | Lifetime of account | — | Owned content stays available while the instructor's account is active |
| **Courses & content** (soft-deleted) | 30 days | `RETENTION_SOFT_DELETE_DAYS` | Same purge cycle as user profiles |
| **Enrollments** | Lifetime of account | — | Required for certificate and completion records |
| **Payments & transactions** | 7 years | — | Statutory minimum for financial records (tax/SOX requirements) |
| **Audit logs** | 90 days | `RETENTION_AUDIT_LOG_DAYS` | Security and compliance audit trail |
| **Session tokens** | Until expiry or explicit revocation | — | Expired tokens are pruned in the next scheduled cleanup |
| **Notifications** | 30 days | `RETENTION_NOTIFICATION_DAYS` | Delivered notifications are removed after this window |
| **Analytics events** | 365 days | `ANALYTICS_RETENTION_DAYS` | Aggregated roll-ups survive; raw events are purged |
| **Messages / chat** | 90 days after last activity | — | Direct messages are treated the same as audit data |
| **Media / uploads** | Lifetime of owning entity | — | Deleted when the owning course or user is purged |
| **GDPR consent records** | 5 years after last interaction | — | Required to demonstrate lawful basis of processing |
| **CCPA opt-out records** | 3 years | — | Required by CCPA regulation §1798.135 |
| **Backups** | 30 days (rolling) | — | Managed by the backup module; see `docs/backup-strategy.md` |

> Retention periods shorter than applicable law are never enforced. When a legal hold is active, all periods below are suspended for the affected data set (see §Legal-Hold Exceptions).

---

## Deletion Process

### Automated purge pipeline

Data deletion is handled by the `DataRetentionService` (`src/data-retention/data-retention.service.ts`) and the scheduled task in `src/data-retention/tasks/data-retention.task.ts`. The pipeline runs on a configurable cron schedule and processes records in batches (`RETENTION_BATCH_SIZE`, default 1 000) to avoid excessive database locks.

**Steps for each purge cycle:**

1. **Identify expired records** — query entities where the relevant timestamp column (`deletedAt`, `createdAt`, `timestamp`) is older than the configured retention threshold.
2. **Archive (optional)** — if `RETENTION_ENABLE_ARCHIVING=true` (the default), copy the raw record payload to the `archived_data` table before deletion. This provides a cold-storage safety net.
3. **Hard delete** — permanently remove the records from the primary table.
4. **Log the outcome** — emit a structured log entry (count of purged records, entity type, cutoff date).

### Manual deletion (right-to-erasure / GDPR Article 17)

User-initiated deletion requests are routed through the GDPR service (`src/modules/gdpr/gdpr.service.ts`):

1. Requester submits a deletion request via `DELETE /gdpr/me` or through the admin portal.
2. The GDPR service verifies the requester's identity and checks for active legal holds.
3. All personal data linked to the account is soft-deleted immediately.
4. The automated purge pipeline hard-deletes the records within `RETENTION_SOFT_DELETE_DAYS` (30 days).
5. A confirmation email and an audit-log entry are generated upon completion.

Financial records (payments, invoices) that must be retained for statutory reasons are **anonymised** rather than deleted: personal identifiers are replaced with pseudonymous tokens while preserving the financial record for accounting purposes.

### CCPA opt-out and data deletion (California residents)

Requests submitted under CCPA (§1798.105 — right to delete) follow the same pipeline as GDPR Article 17 requests. The CCPA controller (`src/modules/ccpa/dto/ccpa.controller.ts`) receives the request and delegates to the same GDPR service deletion flow.

### Batch-size and back-pressure

If the volume of expired records exceeds `RETENTION_BATCH_SIZE`, the purge cycles over multiple scheduler runs rather than processing all records at once. This prevents long-running transactions and excessive memory pressure on the database.

---

## Legal-Hold Exceptions

A **legal hold** suspends the deletion of data that may be relevant to anticipated or ongoing litigation, regulatory investigation, or audit. While a hold is active:

- Automated purge jobs **skip** all records covered by the hold (checked via a `legalHold: true` flag on the entity or in the `legal_holds` table).
- Manual deletion requests for held data are **rejected** with HTTP 451 (Unavailable For Legal Reasons) until the hold is lifted.
- The `archived_data` table entries for held records are marked immutable.

### Placing a legal hold

Legal holds must be initiated by the Legal or Compliance team and are documented as follows:

1. **Request** — the Legal team raises an internal ticket referencing the case number and scope of affected data (user IDs, date ranges, data types).
2. **Implement** — an engineer marks the relevant records in the `legal_holds` table with:
   - `caseId` — unique case identifier
   - `scope` — JSON descriptor of affected entity types and ID ranges
   - `placedAt` — timestamp
   - `placedBy` — employee ID
3. **Verify** — confirm that the next scheduled purge cycle skips the held records and emits a `LEGAL_HOLD_SKIPPED` log event.
4. **Audit** — the hold and all associated decisions are written to the audit log.

### Lifting a legal hold

1. The Legal team confirms in writing (ticket or email) that the hold is no longer required.
2. An engineer sets `liftedAt` and `liftedBy` on the `legal_holds` record.
3. On the next purge cycle, held records re-enter the normal retention schedule. Records that are already past their retention window are purged in that cycle.
4. The lift is recorded in the audit log with reference to the original case ID.

### Emergency preservation

If a hold cannot be placed through the standard flow (e.g., systems are unavailable), the on-call engineer must:

1. Pause the `DataRetentionTask` scheduler immediately.
2. Notify the Legal team and the incident channel.
3. Resume the scheduler only after a hold is formally placed.

---

## Compliance Mapping

| Regulation | Requirement addressed | Section |
|------------|-----------------------|---------|
| GDPR Art. 5(1)(e) – storage limitation | Defined maximum retention periods per data type | Retention Periods |
| GDPR Art. 17 – right to erasure | Deletion workflow and 30-day hard-delete window | Deletion Process |
| CCPA §1798.105 – right to delete | Opt-out and deletion pipeline | Deletion Process |
| SOX / financial record-keeping | 7-year minimum for payment records | Retention Periods |
| GDPR Art. 18 – right to restriction | Legal-hold mechanism suspending deletion | Legal-Hold Exceptions |

---

## Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Platform Engineering | Maintain and operate the automated purge pipeline |
| Legal & Compliance | Approve retention periods, initiate and lift legal holds |
| Data Protection Officer | Oversee GDPR/CCPA compliance, review policy annually |
| On-call Engineer | Handle emergency preservation requests |
| All engineers | Ensure new data types are registered in this document before shipping |

---

## Policy Review

This document must be reviewed and updated:

- Annually, or
- Whenever a new data type is introduced to the system, or
- Whenever applicable law or regulation changes.

Changes require approval from the Legal & Compliance team and must be recorded in `Governance/CHANGELOG.md`.

---

## Related Resources

- Runtime configuration: `src/config/retention.config.ts`
- Data-retention service: `src/data-retention/data-retention.service.ts`
- Scheduled purge task: `src/data-retention/tasks/data-retention.task.ts`
- GDPR module: `src/modules/gdpr/`
- CCPA module: `src/modules/ccpa/`
- Backup strategy: `docs/backup-strategy.md`
- Audit-log service: `src/audit-log/audit-log.service.ts`
