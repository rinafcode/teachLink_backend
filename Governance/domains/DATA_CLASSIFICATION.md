# Data Classification Policy

This document governs how data in the TeachLink Backend is classified,
labelled, and handled: the four classification levels that every data asset
is assigned, the handling rules that apply at each level, and the labelling
requirement that makes classification visible in code and configuration. It
exists so that contributors and maintainers have a single, versioned reference
for deciding how a given piece of data must be stored, transmitted, logged,
and shared — rather than re-deriving those decisions per feature.

This policy is part of the project's **Security & disclosure** area. It lives
entirely inside the `Governance/` folder and does not change application code.

## Scope

This policy applies to every data asset the backend stores, processes, or
transmits: database columns, cache keys, log fields, API request and response
bodies, webhook payloads, file uploads, and inter-service messages. It covers
data at rest, in transit, and in use.

Out of scope:

- **Infrastructure secrets** (API keys, database passwords, private keys).
  These are governed by the secret-management rules in
  [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) and are never classified as ordinary
  data — they are always treated as the most sensitive category regardless of
  what that category is called here.
- **Third-party data.** Data received from an external provider is classified
  by the most restrictive label that either this policy or the provider's
  contract requires.

## Classification Levels

Every data asset in TeachLink Backend is assigned one of the following four
levels. When a compound record contains fields at different levels, the record
as a whole inherits the highest level present.

### Level 1 — Public

Data that is intentionally exposed to anyone, including unauthenticated users
and the general public.

Examples: course catalogue titles and descriptions served without
authentication, publicly visible tutor profiles, marketing copy, open API
documentation.

### Level 2 — Internal

Data that is shared freely within the project and its authenticated users but
is not intended for public release.

Examples: aggregated usage statistics, internal error codes and messages
returned to authenticated API consumers, non-personal course completion
counts, system health metrics.

### Level 3 — Confidential

Data that is restricted to specific roles or services and must not be exposed
beyond its intended audience.

Examples: individual user account details (email address, display name,
enrolment history), payment-transaction metadata (amount, status, provider
reference — not card data), tutor earnings summaries, support-ticket content,
audit log entries.

### Level 4 — Restricted

The most sensitive data the platform holds. Exposure would directly harm users
or the organisation and may carry legal or regulatory consequences.

Examples: authentication credentials and hashed passwords, payment instrument
data (card numbers, bank account details), government-issued identity
documents, private cryptographic key material, full wallet seed phrases,
health or medical information submitted by users.

## Handling Rules

The following rules apply per classification level. A higher level inherits
all rules of the levels below it.

### Level 1 — Public

- May be cached without expiry.
- May be logged in full.
- May be included in error responses returned to unauthenticated callers.
- May be shared with third-party analytics or CDN providers without a
  data-processing agreement, provided no Level 2 or higher data is bundled
  with it.

### Level 2 — Internal

- Must not appear in responses to unauthenticated requests.
- May be logged in full, but log retention follows
  [`LOGGING_RETENTION.md`](LOGGING_RETENTION.md).
- May be shared with third-party tooling (monitoring, error tracking) only
  when that tooling has been vetted under
  [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md).

### Level 3 — Confidential

- Must be encrypted in transit (TLS required on all connections).
- Must not be written to application logs in raw form; structured log fields
  may carry pseudonymised or aggregated representations only.
- Must not appear in error messages returned to end users; use an opaque error
  code and record the detail only in the audit log
  (`src/audit-log/`).
- Must not be shared with a third party unless a data-processing agreement is
  in place and recorded under
  [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md).
- Access by the application layer is role-scoped; a service must not read
  Confidential fields it does not require to perform its function (data
  minimisation).
- Retention must be bounded and must comply with the periods defined in
  [`LOGGING_RETENTION.md`](LOGGING_RETENTION.md).

### Level 4 — Restricted

- Must be encrypted at rest in addition to in transit; plain-text storage of
  Restricted fields is prohibited.
- Must never appear in any log, error response, API response body, or webhook
  payload, even in partial or masked form, unless the masked form is
  specifically required by a payment-industry or regulatory standard.
- Must not be returned by an API endpoint unless that endpoint exists solely
  to serve that field to its owner (for example, a user retrieving their own
  recovery codes) and is protected by re-authentication or step-up
  verification.
- Write access requires a recorded justification per feature or change in the
  pull request, and is audited via the `@Audit()` decorator
  (`src/audit-log/`).
- Must never be shared with a third party that is not explicitly listed,
  vetted, and approved under [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md).
- Deletion requests from users must be honoured promptly and completely.

## Labelling Requirement

Every data asset must carry its classification label so that reviewers,
auditors, and automated tooling can identify it without re-reading this
document.

**Database columns and entities.** Each TypeORM entity column that holds
Confidential or Restricted data carries a JSDoc comment of the form
`@classification Confidential` or `@classification Restricted`. Public and
Internal columns may be labelled; they are not required to be.

**API DTOs and response types.** DTOs that carry Confidential or Restricted
fields include the classification in the `@ApiProperty` description or in a
`@classification` JSDoc tag on the class or property.

**Audit log events.** `AuditSeverity` (`src/audit-log/enums/audit-action.enum.ts`)
is set to `CRITICAL` for any event that creates, reads, updates, or deletes a
Restricted field, and to `ERROR` or higher for Confidential fields that carry
significant personal data.

**Pull request bodies.** Any PR that introduces or changes the storage,
transmission, or processing of Confidential or Restricted data states the
classification level and the specific handling rules applied in its description.

## Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces
no runtime behaviour, no schema change, and no executable code, so it adds no
tests and requires none. When a future code change introduces or reclassifies
a Confidential or Restricted field, that change ships with:

- A unit test asserting that the field is not included in log output or error
  responses.
- An audit-log test confirming that the appropriate `AuditSeverity` is emitted
  for access to that field, following the pattern in
  `src/audit-log/`.

Existing lint, typecheck, build, and test suites must continue to pass, and
the change is verified by the standard CI pipeline described in `CONTRIBUTING.md`.

## Review

This policy is reviewed whenever the types of data the platform holds change
materially — for example when a new category of personal data is introduced,
when a regulatory requirement changes, or when a handling rule proves
impractical. Changes are proposed through the normal governance process
described in `Governance/README.md` and must touch only the `Governance/`
folder.

## Related Documents

- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording for Confidential and
  Restricted field access.
- [`LOGGING_RETENTION.md`](LOGGING_RETENTION.md) — retention periods that
  bound how long classified data may be held in logs.
- [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) — vetting and
  data-sharing limits for external providers.
- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — secret management, which governs
  credentials outside the scope of this classification scheme.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — which team or maintainer
  owns a service that stores Confidential or Restricted data.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
