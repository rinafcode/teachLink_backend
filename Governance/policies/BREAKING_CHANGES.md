# Breaking Change Policy — TeachLink Backend

**Status:** Active
**Applies to:** `teachLink_backend` (NestJS, TypeScript, PostgreSQL, Redis)
**Owner:** TeachLink backend maintainers
**Last reviewed:** 2026-10-03

This document defines what constitutes a breaking change, how breaking changes are
communicated and versioned, and the process contributors and maintainers must follow
when introducing one. It is the normative reference referenced by
[`VERSIONING.md`](VERSIONING.md) for MAJOR-version determinations.

---

## 1. Table of Contents

1. [Purpose](#1-purpose)
2. [What is a breaking change](#2-what-is-a-breaking-change)
3. [What is not a breaking change](#3-what-is-not-a-breaking-change)
4. [Communication requirements](#4-communication-requirements)
5. [Versioning and deprecation](#5-versioning-and-deprecation)
6. [Database and schema changes](#6-database-and-schema-changes)
7. [Event and queue contract changes](#7-event-and-queue-contract-changes)
8. [Process](#8-process)
9. [Enforcement](#9-enforcement)

---

## 1. Purpose

Consumers of TeachLink Backend — internal services, frontend clients, integration
partners — depend on stable contracts. This policy ensures that any change that could
break a consumer is identified, communicated, and versioned deliberately rather than
silently shipped.

---

## 2. What is a breaking change

A change is **breaking** when it can cause an existing, correctly-behaving consumer to
fail. Examples include:

| Surface | Breaking examples |
|---|---|
| HTTP / GraphQL API | Removing or renaming an endpoint, field, enum value, or input argument; changing a field's type; changing an error code or error payload shape; making a previously optional input required. |
| Authentication / authz | Changing token format or claims; requiring new scopes; altering permission checks that previously allowed a request. |
| Event / queue contracts | Removing or renaming an event type; changing payload field names, types, or required-ness; changing the queue or subject name. |
| Database schema | Dropping or renaming a column/table; changing a column type incompatibly; changing a unique constraint that existing data violates. |
| Configuration | Removing or renaming an environment variable; changing a default that alters behaviour when the variable is unset. |
| SDK / client library | Removing a public export; changing a method signature; changing a returned type. |

---

## 3. What is not a breaking change

The following are **additive** or **internal** and do not require a MAJOR bump:

- Adding a new endpoint, field, enum value, or optional input argument.
- Adding a new event type or new optional payload field.
- Adding a new environment variable with a safe default.
- Fixing a bug that brings behaviour in line with documented behaviour.
- Internal refactors with no observable contract change.
- Performance improvements that preserve the external contract.
- Adding deprecation warnings to existing behaviour.

---

## 4. Communication requirements

Before merging a breaking change, the author must:

1. **Label the PR** with `breaking-change` (or the repository's equivalent).
2. **Update the changelog** under a `BREAKING CHANGES` section describing:
   - What changed.
   - Why it changed.
   - What consumers must do to adapt.
3. **Open (or reference) a migration issue** when the change requires coordinated
   consumer action, so the work is trackable.
4. **Notify affected consumers** through the channels listed in
   [`COMMUNICATION_NORMS.md`](COMMUNICATION_NORMS.md) at least one release cycle
   before the change lands on a stable branch, when practical.

For urgent security fixes, communication may be compressed; see
[`EMBARGO.md`](EMBARGO.md) and [`SECURITY_POLICY.md`](../SECURITY_POLICY.md).

---

## 5. Versioning and deprecation

Breaking changes follow the MAJOR-version rules in
[`VERSIONING.md`](VERSIONING.md):

- While the project is `0.x.y`, breaking changes may land in MINOR releases but
  **must** still be documented per section 4.
- At `1.0.0` and above, breaking changes require a MAJOR bump.
- When practical, a breaking change should be preceded by a deprecation window:
  mark the old behaviour deprecated (log warnings, add `@deprecated` annotations,
  publish a changelog entry) for at least one minor release before removal.
- Deprecation removals are themselves breaking changes and follow this policy.

---

## 6. Database and schema changes

Schema changes carry additional constraints:

- **Additive migrations** (new tables, new nullable columns, new indexes) are
  non-breaking and may ship in any release.
- **Destructive migrations** (drop, rename, type-change) are breaking. They must:
  - Ship behind a feature flag or in a release that explicitly requires a coordinated
    deploy.
  - Include a rollback path documented in the migration PR.
  - Be reviewed against [`MIGRATION_ROLLBACK.md`](../domains/MIGRATION_ROLLBACK.md)
    and [`SCHEMA_CHANGE.md`](../domains/SCHEMA_CHANGE.md).

---

## 7. Event and queue contract changes

Events consumed by downstream services are a public contract:

- Removing or renaming an event type is breaking.
- Adding a new optional field to an event payload is non-breaking.
- Changing the meaning or units of an existing field is breaking even if the type
  is unchanged.
- Consumers must be able to ignore unknown fields; producers must not rely on
  consumers rejecting them.

Event schema changes must be reviewed against
[`WEBHOOK_GOVERNANCE.md`](../domains/WEBHOOK_GOVERNANCE.md) when webhooks are
involved.

---

## 8. Process

1. Identify the change as breaking (section 2) or additive (section 3).
2. If breaking, open a PR that:
   - Implements the change.
   - Adds the `breaking-change` label.
   - Updates the changelog.
   - Includes migration notes or a linked migration issue.
3. Obtain review per [`REVIEW_POLICY.md`](REVIEW_POLICY.md). Breaking changes
   require at least one maintainer approval.
4. Schedule the merge for a release that follows the versioning rules in section 5.
5. After merge, confirm affected consumers have been notified (section 4).

---

## 9. Enforcement

- PRs labelled `breaking-change` that lack a changelog entry will be blocked by
  review.
- Maintainers are responsible for catching breaking changes that are not labelled;
  if one slips through, it is reverted or follow-up deprecation is scheduled in the
  next release.
- This policy is referenced by [`VERSIONING.md`](VERSIONING.md); conflicts are
  resolved in favour of the more recent document, with the maintainers' decision
  logged in [`DECISION_LOG.md`](../DECISION_LOG.md).

---

## Related documents

- [`VERSIONING.md`](VERSIONING.md) — version scheme and bump rules.
- [`CHANGELOG_POLICY.md`](CHANGELOG_POLICY.md) — changelog format and required sections.
- [`DEPRECATION.md`](DEPRECATION.md) — deprecation mechanics.
- [`MIGRATION_ROLLBACK.md`](../domains/MIGRATION_ROLLBACK.md) — safe schema migration.
- [`SCHEMA_CHANGE.md`](../domains/SCHEMA_CHANGE.md) — schema change governance.
- [`COMMUNICATION_NORMS.md`](COMMUNICATION_NORMS.md) — how to notify consumers.
