# Audit Log Governance Policy

This document governs what must be recorded in the audit log
(`src/audit-log/`), how the immutability of that record is preserved, and how
often it is reviewed. It exists so that security-relevant activity in
TeachLink Backend has a trustworthy, versioned record that both engineering
and compliance can rely on.

This policy is part of the project's **Security & disclosure** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Events That Must Be Audited

Any action in the categories defined by `AuditCategory`
(`src/audit-log/enums/audit-action.enum.ts`) must be recorded via the audit
log service or the `@Audit()` decorator, not logged ad hoc through the
general application logger. At minimum, this covers:

- **Authentication** — login, failed login, logout, registration, password
  reset/change, MFA enable/disable/failure, session expiry and revocation.
- **Authorization** — permission denials, RBAC role and permission grants,
  revocations, creation, updates, and deletions.
- **Data access and modification** — viewing, creating, updating, deleting,
  exporting, or importing records that contain user or business data.
- **File operations** — upload, download, deletion, and sharing.
- **Admin operations** — configuration and setting changes, backup creation
  and restoration.
- **Compliance operations** — data-retention policy application, audit-log
  exports, generated reports, and payment-reconciliation mismatches.

A new action added to `AuditAction` must fall into one of the existing
`AuditCategory` values, or the category enum is extended in the same change —
the audit log's categorisation must never fall behind the actions it records.

Every audited event records, at minimum, the action, category, severity
(`AuditSeverity`), the acting user (where one exists), the affected entity
type and ID, and a timestamp, matching the columns already indexed on the
`AuditLog` entity.

## Immutability Requirement

- Audit log rows are **append-only**. The application layer must never update
  or soft-delete a row after it is written — this is a hard invariant of the
  `AuditLog` entity, not a convention that individual call sites opt into.
- The only sanctioned removal path is the retention policy's hard-delete of
  rows whose `retentionUntil` has passed (see
  `Governance/domains/LOGGING_RETENTION.md` for the retention periods this
  policy defers to). Any other deletion of audit rows — manual, ad hoc, or
  via a generic admin "delete record" tool — is out of policy.
- Because rows are immutable, corrections to a mistaken entry are made by
  writing a new, linked entry that references the original (e.g. via
  `entityType`/`entityId`), never by editing the original row.
- Write access to the audit log table is restricted to the application's own
  service layer; no direct database access path for mutating audit rows is
  exposed to end users or admin tooling.

## Review Cadence

- **Weekly.** The on-call/security-conscious maintainer (see
  `Governance/domains/SERVICE_OWNERSHIP.md`) scans for `CRITICAL` and `ERROR`
  severity events and unexplained spikes in `SECURITY` or `AUTHORIZATION`
  category events.
- **Monthly.** Maintainers sample recent entries across categories to confirm
  new code paths that should be audited are actually emitting events —
  coverage drifts silently when a new endpoint is added without an
  `@Audit()` decorator.
- **Quarterly.** A full review confirms the `AuditAction` and `AuditCategory`
  enums still match the actions the system actually performs, and that the
  retention policy is deleting rows on schedule rather than accumulating
  unbounded history.
- **On incident.** Any security incident triggers an immediate audit-log
  review as part of the incident's investigation in `src/incident-management/`.

## Review

This policy is reviewed at least once a year, or whenever the audited event
categories change materially. Changes are proposed through the normal
governance process described in `Governance/README.md` and must touch only
the `Governance/` folder.
