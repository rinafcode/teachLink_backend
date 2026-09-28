# Service Ownership Policy

This document governs who owns each service (module) in the TeachLink Backend
monolith, how on-call responsibility is mapped to that ownership, and who is
escalated to when an owner is unavailable. It exists so that every incident,
review request, and cross-module change has a clear, discoverable point of
contact rather than defaulting to "whoever is around."

This policy is part of the project's **Contribution governance** and
**Roles & membership** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Ownership Model per Service

- A "service" is a top-level module directory under `src/` (for example
  `src/payments/`, `src/incident-management/`, `src/webhooks/`) together with
  its entities, migrations, and tests. A service is the unit of ownership;
  ownership is never assigned at the file level.
- Every service has exactly one **primary owner** — an individual maintainer
  accountable for its health — and may have one or more **secondary owners**
  who can review and act in the primary's absence.
- Ownership is granted when a maintainer authors or substantially rewrites a
  service, or is explicitly assigned it through the nomination process in
  `Governance/processes/NOMINATION.md`. Ownership is not automatic from
  having merged a single pull request into a module.
- Ownership is recorded in that service's own `README.md` (most service
  directories already have one, e.g. `src/incident-management/README.md`,
  `src/webhooks/README.md`) under an "Owner" line, and in the project's
  `CODEOWNERS` file where one is maintained, so ownership is visible both
  in-repo and in GitHub's review-assignment UI.
- A service with no assigned owner is **unowned**. Unowned services are
  flagged at the maintainers' quarterly review (see Review Cadence below) and
  either assigned an owner or explicitly marked deprecated.
- Changing a service's owner (handoff, offboarding, or reassignment) is a
  one-line update to that service's `README.md` and does not require a vote,
  but must be announced to the maintainers so `CODEOWNERS` and the on-call
  mapping stay accurate.

## On-Call Mapping

- On-call responsibility follows service ownership: the primary owner is the
  first point of contact for incidents in their service, escalating to a
  secondary owner if unreachable, matching the escalation chain implemented
  by `NotificationAndEscalationService` in `src/incident-management/`.
- A service without a dedicated on-call rotation defaults to the general
  maintainer rotation. Services handling payments, authentication, or
  personal data (see `Governance/domains/THIRD_PARTY_INTEGRATION.md`'s
  data-sharing limits) must have a named on-call owner, not the default
  rotation.
- The on-call mapping (service → primary owner → secondary owner) is kept in
  one place, referenced from `Governance/README.md`, and updated in the same
  pull request as any ownership change described above.
- On-call owners are expected to acknowledge a page within the response time
  defined by `src/incident-management/`'s severity levels for the incident,
  not this document — this policy governs *who* is contacted, not response
  SLAs.

## Escalation Contacts

- If a primary owner does not acknowledge an incident within the expected
  window, escalation proceeds to the secondary owner, then to the on-duty
  maintainer, in that order.
- If no owner or secondary owner responds, escalation reaches the full
  maintainer group through the project's incident channel. This is a
  last-resort path, not a substitute for keeping the on-call mapping current.
- Escalation contacts are reviewed whenever a maintainer's availability
  changes (see `Governance/policies/INACTIVITY.md`) and as part of the
  quarterly review below.
- Escalations and their outcomes are recorded as incidents in
  `src/incident-management/`, so patterns (a service escalating repeatedly)
  are visible and actionable rather than anecdotal.

## Review Cadence

- **Quarterly.** Maintainers review the full service-ownership map: every
  service under `src/` has a listed owner, unowned services are addressed,
  and the on-call mapping matches current maintainer availability.
- **On maintainer offboarding.** Ownership of every service owned by a
  departing maintainer is reassigned before their access is revoked, per
  `Governance/processes/OFFBOARDING.md`.
- **On new service.** A new top-level module under `src/` is assigned an
  owner before or in the same pull request that introduces it.

## Review

This policy itself is reviewed at least once a year, or whenever the
ownership or escalation model changes materially. Changes are proposed
through the normal governance process described in `Governance/README.md`
and must touch only the `Governance/` folder.
