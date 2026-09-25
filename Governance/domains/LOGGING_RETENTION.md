# Logging Retention Policy

This document governs how long each type of log or log-adjacent record is
kept, how personally identifiable information (PII) is kept out of what is
retained, and who can access it. It exists so that TeachLink Backend keeps
enough history to debug and audit, without accumulating data indefinitely or
leaking sensitive information into logs.

This policy is part of the project's **Security & disclosure** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Scope

This policy covers every category of log this service produces or persists:

- **Application/structured logs** — emitted via `LoggerService` /
  `structured-logging.ts` and the HTTP request logs from
  `HttpLoggingInterceptor`, typically shipped to the platform's log
  aggregator rather than the database.
- **Audit logs** — persisted rows in `src/audit-log/`, governed together with
  `Governance/domains/AUDIT_LOG.md` for content and immutability; this policy
  is authoritative for *how long* they are kept.
- **Notifications** and other operational records purged by
  `DataRetentionService` alongside logs, where their retention is configured
  and enforced the same way.

## Retention Period per Log Type

Retention periods are configuration-driven (see `DataRetentionService` and
its `retention.*` config keys) so they can be tuned per environment without a
code change. The values below are this project's defaults; an environment
that overrides them must not go *below* these floors without a documented,
reviewed exception.

| Log type | Config key | Default retention |
| --- | --- | --- |
| Audit logs | `retention.auditLogRetentionDays` | 90 days |
| Soft-deleted application records | `retention.softDeleteRetentionDays` | 30 days |
| Notifications | `retention.notificationRetentionDays` | 30 days |
| Application/structured logs (aggregator-side) | platform log-aggregator retention | 30 days, unless a longer period is required for an active investigation |
| HTTP request logs | platform log-aggregator retention | 30 days |

A log type not listed here defaults to the application/structured-log period
until it is added explicitly. Extending any retention period beyond its
default requires a stated reason (an active investigation, a compliance
requirement) and is time-boxed, not a silent permanent increase.

## PII-Redaction Rule

- Logs must never contain raw secrets or credentials. `SensitiveDataMasker`
  (`src/logging/sensitive-data.masker.ts`) redacts known sensitive keys
  (passwords, tokens, API keys, authorization headers, card numbers, and
  similar) before a log line is emitted, and every new logger call site
  that might log a request/response body or an arbitrary object must pass
  through it rather than logging the raw object.
- Direct PII (email addresses, full names, physical addresses, payment
  identifiers) is not logged in plain form at INFO level or below. Where an
  identifier is needed for correlation, prefer a stable internal ID (user ID,
  request ID from `request-id.middleware.ts`) over the PII value itself.
  Where the PII value truly must appear (e.g. a support-escalation log), it
  is masked to a partial value (e.g. the last 4 characters of an email
  domain) rather than logged in full.
- Audit logs are the one place PII is expected to appear in full for
  security-relevant events (see `Governance/domains/AUDIT_LOG.md`), because
  they are access-controlled per the section below and retained under this
  policy's audit-log period.
- Every new log statement that logs a structured object (not just a plain
  message) is expected to pass through the masking utility or an equivalent
  redaction step; this is checked at code review, not enforced mechanically
  today.

## Access Controls

- Persisted audit logs are readable only through the audit-log service's own
  query surface (e.g. an authorized export), never via direct database
  access from application code outside `src/audit-log/`. Exports are
  themselves an audited event (`AUDIT_LOG_EXPORTED`).
- Aggregator-side application and HTTP logs are accessible only to
  maintainers and on-call engineers, via the platform's log-aggregator
  access controls — not exposed through any application API.
- Access to logs containing masked-but-still-sensitive context (e.g. a
  partially masked identifier used for support) is limited to the roles that
  need it for incident response or support, consistent with the role model
  in `Governance/roles/`.
- Any access to raw (pre-masking) log data, where it is technically possible
  during an investigation, is itself logged and reviewed after the fact.

## Review

This policy is reviewed at least once a year, whenever a retention default
changes, or whenever a new log type is introduced. Changes are proposed
through the normal governance process described in `Governance/README.md`
and must touch only the `Governance/` folder.
