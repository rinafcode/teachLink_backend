# On-Call Coverage Matrix

This matrix defines the coverage windows for on-call response to TeachLink
Backend incidents, who fills each window, and what happens when a window
has no volunteer. It exists so that every hour of the year has a named
responder — or a documented, accepted gap.

This document is part of the project's **Operations** area. It lives
entirely inside the `Governance/` folder and does not change application
code. The escalation expectations that use this matrix are in
`Governance/matrices/ESCALATION_MATRIX.md`.

## Coverage Windows

| Window | Days / hours (UTC) | Service level |
|---|---|---|
| Business hours | Mon–Fri, 08:00–18:00 | Primary and backup both scheduled. |
| Out of hours | Mon–Fri, 18:00–08:00; Sat 00:00–Mon 08:00 | Primary required; backup on best effort. |
| Declared incident (any time) | While an incident is open | Primary and backup required regardless of window. |

## Primary And Backup Assignment

| Period | Primary | Backup |
|---|---|---|
| *(rotations recorded here at the start of each period)* | | |

- **Primary** answers within the Tier 2 response target of
  `Governance/matrices/ESCALATION_MATRIX.md`, owns coordination until
  handover, and writes the incident record.
- **Backup** is contacted at the same time as the primary; if the primary
  does not acknowledge inside the response target, the backup assumes the
  page. Backup is never a silent second name — both know they are scheduled.
- Assignments are recorded per period (weekly is the default rotation) and
  are announced when the period opens; a period with no posted assignment
  falls back to the previous period's names until reassigned.
- Only Active maintainers from
  `Governance/registers/MAINTAINERS_REGISTER.md` may be scheduled.

## Gap Handling

1. **Swap requested** — a scheduled responder who cannot cover proposes a
   swap in the rotation channel at least 24 hours ahead when possible; the
   swap takes effect once another eligible responder accepts it, and the
   matrix is updated in the same change.
2. **Unfilled window discovered** — the previous responder remains
   nominally on call until a replacement accepts; the gap is posted to the
   maintainer channel immediately, not at the start of the window.
3. **No volunteer** — after the window opens with no acceptance, every
   Active maintainer is notified directly. If nobody accepts within one
   hour, the window is recorded as an **accepted gap**: which window, why,
   and who acknowledged it, entered in this matrix.
4. **Accepted gaps** are reviewed at the quarterly governance review
   (`Governance/runbooks/QUARTERLY_GOVERNANCE_REVIEW.md`); two accepted
   gaps in the same quarter trigger a rotation change rather than a third
   gap.
