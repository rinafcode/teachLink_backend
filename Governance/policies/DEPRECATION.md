# Deprecation Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-29
- **Review cadence:** Every 6 months, or whenever a deprecation is shortened by
  exception (§6)

This policy defines how TeachLink Backend deprecates and removes functionality
that others may rely on: the minimum notice period before removal, the
channels a deprecation must be announced through, and the criteria that must
all be met before the deprecated item is actually removed. It exists so that
deprecation is predictable and never a surprise to consumers, contributors, or
maintainers.

"Deprecated" means the item still works and is still supported, but is
scheduled for removal and should not be used for new work. "Removal" means the
item is deleted or stops working.

This document is governance only. It does not change application behaviour and
is scoped entirely to the `Governance/` folder.

## 1. Scope

This is the general policy for deprecating anything the project exposes to
contributors, other modules, or consumers, including:

- Configuration options and environment variables.
- Internal modules, services, and interfaces used across a module boundary.
- Documented scripts, CLI commands, and tooling.
- Governance documents and processes themselves (see
  [Contributing to governance](../README.md#contributing-to-governance)).

**REST endpoints, response fields, OpenAPI schema objects, and SDK method
signatures are governed instead by
[`domains/API_DEPRECATION.md`](../domains/API_DEPRECATION.md)**, which sets a
longer, consumer-tiered support window and the specific deprecation-header and
OpenAPI requirements for a public API surface. Where the two documents
overlap, `domains/API_DEPRECATION.md` is authoritative for API surfaces; this
policy is authoritative for everything else, and also states the general
notice-period floor and communication baseline that
`domains/API_DEPRECATION.md` builds on.

Out of scope: undocumented, internal-only code that has never been exposed to
another module or consumer, and changes made solely to fix an active security
vulnerability, which may skip the notice period under the exception in §6.

## 2. Deprecation notice period

The item must remain fully working and supported for the entire notice
period. The minimum notice before removal is:

| Type of change | Minimum notice |
| --- | --- |
| Configuration option or environment variable | 60 days |
| Internal module, service, or interface used across modules | 30 days |
| Documented script, CLI command, or tooling | 30 days |
| Governance document, role, or process | 30 days |

Rules that apply to every deprecation:

- **The clock starts at merge.** The notice period begins on the date the pull
  request introducing the deprecation is merged, not when it is first
  proposed.
- **Extend, don't silently shorten.** A maintainer may lengthen a notice
  period at any time. Shortening one requires the exception process in §6.
- **Removal is a breaking change.** Removal ships in a change that follows the
  notice period and is treated as a breaking change for versioning purposes.
- **Name the replacement.** The deprecation notice states the supported
  replacement, or explains clearly that there is none.

## 3. Communication channels

A deprecation is announced through all of the following that apply. A
deprecation that skips a required channel has not started its notice period.

1. **Tracking issue.** A GitHub issue describing what is deprecated, why, the
   replacement, and the earliest removal date. It stays open until removal is
   complete.
2. **Changelog entry.** An entry in the project's changelog (or, where none is
   maintained for the affected area, the pull request description) recording
   the deprecation, and a matching entry when the item is actually removed.
3. **Code annotation.** The deprecated code carries a `@deprecated` tag naming
   the replacement and the earliest removal date.
4. **Documentation update.** Any user-facing or contributor-facing
   documentation that mentions the item (README, `docs/`, or the relevant
   `Governance/` document) is updated to mark it deprecated and link to the
   replacement.
5. **Runtime warning, where applicable.** A deprecated code path that runs
   logs a warning when used, so usage can be measured before removal.

API surfaces additionally require the deprecation headers and OpenAPI updates
specified in [`domains/API_DEPRECATION.md`](../domains/API_DEPRECATION.md)
§"Deprecation Headers and Notices".

## 4. Removal criteria

An item may be removed only when **all** of the following are true:

1. The minimum notice period in §2 has fully elapsed (or the longer,
   surface-specific window in `domains/API_DEPRECATION.md` applies and has
   elapsed).
2. The deprecation was announced through the channels in §3.
3. A replacement exists and is documented, or a maintainer has recorded in the
   tracking issue why no replacement is needed.
4. The tracking issue has no unresolved objection from a maintainer or a known
   consumer.
5. The removal is recorded in the changelog and, where the removal is a
   breaking change, the version bump reflects that.
6. Existing lint, typecheck, build, and test suites pass after the removal.

If any criterion is not met, removal is postponed and the tracking issue is
updated with a revised date.

## 5. Proposing a deprecation

1. **Open an issue** describing the item, the reason, the proposed
   replacement, and the proposed removal date.
2. **Confirm the period.** A maintainer confirms the notice period from §2
   (or the applicable window in `domains/API_DEPRECATION.md`) and approves the
   plan.
3. **Ship the notice.** The pull request that introduces the deprecation
   includes the annotation and documentation updates from §3, and a
   changelog entry recording the deprecation.
4. **Track to removal.** The issue stays open until the criteria in §4 are
   met and the removal has shipped.

A deprecation may be withdrawn at any time before removal. The maintainers
announce the reversal through the same channels used for the original notice
and update the tracking issue.

## 6. Exceptions

A shorter notice period is allowed only when:

- a security vulnerability cannot be mitigated without removing the item,
- a legal, licensing, or compliance requirement forces removal, or
- an upstream dependency or provider ends support and leaves no viable
  alternative.

An exception requires approval from at least one maintainer other than the
proposer. The tracking issue must state the reason and the shortened
timeline, and known consumers are notified through the channels in §3 as soon
as possible. Where the exception is security-driven, the project's security
disclosure process governs coordination and timing and takes precedence over
this section.

## 7. Relationship to other policies

- [`domains/API_DEPRECATION.md`](../domains/API_DEPRECATION.md) — the
  authoritative, longer support window and header requirements for REST
  endpoints, fields, OpenAPI schema, and SDK methods.
- [`domains/API_CHANGE_GOVERNANCE.md`](../domains/API_CHANGE_GOVERNANCE.md) —
  how a change to an API is reviewed and approved before it can be deprecated.

Where this policy and another governance document conflict, the more specific
document prevails for its subject matter, and the conflict is recorded as a
governance issue.

## 8. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-29 | Initial deprecation policy (notice periods, communication channels, removal criteria). |
