# On-Call Governance Policy

This document governs on-call in the TeachLink Backend project: how the
rotation is structured, which escalation tiers exist and when each is reached,
and what compensation or time off an on-call contributor is entitled to. It
exists so that being paged is a defined, bounded, and fairly compensated
responsibility rather than an informal expectation on whoever is reachable.

This policy is part of the project's **Roles & membership** and
**Contribution governance** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Scope

This policy applies to anyone holding on-call responsibility for a service in
this repository, and to the maintainers who set and review the rotation. It
covers human paging and response; the automated detection, notification, and
escalation machinery it relies on is implemented in
`src/incident-management/`, and this document defines the *human* model that
machinery is expected to match.

## Relationship to Service Ownership

- On-call follows service ownership. The primary owner of a service, as defined
  by `Governance/domains/SERVICE_OWNERSHIP.md`, is the first point of contact
  for incidents in that service; the secondary owner is the first escalation.
- A service without a dedicated rotation falls back to the general maintainer
  rotation. Services handling payments, authentication, or personal data must
  have a **named** on-call owner rather than relying on the fallback.
- Changing a service's owner (handoff, offboarding, or reassignment) updates the
  rotation in the same change, per `Governance/processes/OFFBOARDING.md`.

## Rotation Model

- The rotation is **per service**, held by the service's primary and secondary
  owners, and runs in **one-week** shifts with a scheduled handover. A one-week
  shift keeps the pager load small enough to plan around and short enough that
  it is shared.
- The on-call mapping (service → primary owner → secondary owner → shift
  window) is kept in one place, referenced from `Governance/README.md`, and is
  the authoritative record. A service's own `README.md` carries its owner line,
  as `Governance/domains/SERVICE_OWNERSHIP.md` requires; the schedule itself is
  not duplicated per service.
- Handover is explicit: the outgoing on-call records any open incident, any
  in-flight mitigation, and anything being watched, so the incoming on-call
  starts from a known state rather than a clean slate.
- Coverage is expected across the shift's working hours. Out-of-hours paging is
  limited to what the severity tiers below permit; a service that pages its
  owner outside those hours without a `critical` incident is a rotation-design
  problem to fix, not a duty to absorb.
- No one takes two consecutive primary shifts for the same service without an
  explicit, recorded agreement between the owners involved.
- Unavailability for a shift is declared ahead of time and covered by the
  secondary owner. A maintainer who cannot cover their rotation follows
  `Governance/policies/INACTIVITY.md` rather than leaving the pager unattended.

## Escalation Tiers

Escalation tiers are anchored to the incident severity levels defined in
`src/incident-management/entities/incident.entity.ts` (`IncidentSeverity`:
`info`, `warning`, `critical`) and use the timings already configured in
`NotificationAndEscalationService`'s escalation policies.

| Tier | Who | Reached when | Anchor |
| --- | --- | --- | --- |
| **T1 — Primary on-call** | Service primary owner | Every incident for the service; paged within the severity's window | `critical` 1 min, `warning` 3 min, `info` 5 min |
| **T2 — Secondary on-call** | Service secondary owner | T1 does not acknowledge within the severity window | After the T1 notification retries are exhausted |
| **T3 — On-duty maintainer** | Maintainer on duty | T2 does not acknowledge, or the incident spans services | Escalation to the maintainer group |
| **T4 — Full maintainer group** | Maintainers, via the incident channel | T3 is unavailable, or the incident is project-wide | Last resort; never a substitute for a current mapping |

- Notification channels and retry counts are the ones already implemented
  (`NotificationAndEscalationService`: `critical` — Slack, email, and
  PagerDuty, 3 retries; `warning` — Slack and email, 2 retries; `info` — no
  external recipients, 1 retry). Changing a tier's channel or timing is a
  change to that service, reviewed like any other code change.
- Acknowledgement, not resolution, is what stops the escalation clock: an
  acknowledged incident that is still burning does not silently escalate to T3
  as if no one were there.
- Any incident that reaches T3 or T4 requires a postmortem under
  `Governance/domains/POSTMORTEM_POLICY.md` when it also meets that policy's
  severity, data-loss, outage-duration, or recurrence thresholds.
- The escalation path is exercised in practice, not only on paper: the
  response-time expectations a service publishes are those its severity tiers
  justify, and paging a tier that cannot act is treated as a broken mapping.

## Compensation and Time-Off Rules

- On-call is compensated work. Carrying the pager for a shift is recognised
  either by an on-call stipend or by **time off in lieu**, at the rate the
  maintainers set for the period; the rate is recorded where the community can
  see it, and disbursed through the treasurer under the spending authority in
  `Governance/roles/TREASURER.md`.
- **Out-of-hours work is compensated even when the shift is otherwise quiet.**
  A page answered outside working hours earns time off in lieu for the time
  actually worked, at minimum — it does not consume the on-call stipend for
  that shift.
- **Rest after a disruptive night.** An on-call contributor paged outside
  working hours for more than a sustained window is entitled to equivalent
  rest or time off in lieu in the following working period, so a bad night does
  not compound into a bad week. The specific window is set by the maintainers
  and published with the rate above.
- Compensation is claimed and recorded, not assumed: the on-call owner records
  the shift, the pages answered, and the out-of-hours time worked, and the
  record is the basis for the stipend or time off. Records are reviewed
  alongside the quarterly rotation review below.
- On-call load is reviewed quarterly, together with the service-ownership map
  (`Governance/domains/SERVICE_OWNERSHIP.md`): the number of pages per shift,
  time spent out of hours, and any shift that repeatedly exceeds the expected
  load. A rotation that consistently over-pages one person is corrected at that
  review — its detection rules, staffing, or both.
- Compensation policy here defines entitlement and the mechanism; the amounts,
  rates, and payout schedule are set by the maintainers and executed by the
  treasurer, and are not fixed by this document.

## Review

This policy is reviewed whenever the ownership model, the incident severity
levels, or the escalation machinery changes materially, and at least once a
year. Changes are proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.
