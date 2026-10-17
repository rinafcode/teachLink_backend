# Escalation Matrix

This matrix defines who is contacted, in what order, and how quickly when
an issue in TeachLink Backend cannot be resolved at the current level. It
exists so that escalation is a procedure instead of an argument about who
to wake up.

This document is part of the project's **Operations** area. It lives
entirely inside the `Governance/` folder and does not change application
code. The path below extends `Governance/processes/ESCALATION_PATH.md`.

## Escalation Tiers

| Tier | Trigger | Contacted |
|---|---|---|
| 1 | A support or triage question; a bug with a workaround; a routine review stalled beyond its target. | On-call triager (`Governance/matrices/ONCALL_COVERAGE_MATRIX.md`). |
| 2 | A production incident without a workaround; a security report under coordinated disclosure; a release blocked on a decision only maintainers can make. | Maintainer on call for the affected area (see `Governance/registers/MAINTAINERS_REGISTER.md`). |
| 3 | An incident with customer or data impact that Tier 2 cannot contain; a governance or policy dispute; a conflict requiring formal handling. | Two maintainers from separate areas jointly, plus the governance owner. |
| 4 | Tier 3 unresolved after the response target; disclosure decision needed; project-level risk. | Full maintainer set, convening the process in `Governance/processes/CONFLICT_RESOLUTION.md` or `Governance/processes/COORDINATED_DISCLOSURE.md` as applicable. |

## Contacts Per Tier

| Tier | How contacted | Fallback when no response |
|---|---|---|
| 1 | Project issue channel / on-call rotation. | Next person in the on-call rotation. |
| 2 | Direct mention of the area maintainer in the incident channel. | Any other Active maintainer from the register. |
| 3 | Direct mention of both contacted maintainers. | Escalate immediately to Tier 4; do not wait. |
| 4 | Maintainer-wide announcement. | Record the attempt and the silence in the incident record; proceed under the applicable process with those who responded. |

Contacts are GitHub handles from `Governance/registers/MAINTAINERS_REGISTER.md`
— this matrix intentionally names roles, not personal addresses, so it does
not rot when people change jobs.

## Response Targets

| Tier | First response target | Escalation deadline |
|---|---|---|
| 1 | 24 hours (business days). | No response in 48 hours → Tier 2. |
| 2 | 4 hours, around the clock. | No containment in 4 hours → Tier 3. |
| 3 | 2 hours. | Unresolved after 24 hours → Tier 4. |
| 4 | 1 hour during a declared incident. | Tracked to resolution in the incident record. |

- Response means an acknowledged, substantive reply — a reaction emoji does
  not stop a deadline.
- Each tier's deadline runs from when the escalation was posted, and each
  attempt to contact the next tier is recorded with its timestamp.
- Security reports follow the faster path in
  `Governance/processes/COORDINATED_DISCLOSURE.md`; where it differs from
  this matrix, that process wins.
