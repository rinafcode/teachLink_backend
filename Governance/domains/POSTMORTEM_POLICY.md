# Incident Postmortem Policy

This policy defines when TeachLink Backend incidents require a postmortem,
what the review records, and how follow-up actions are tracked. Its purpose is
to improve the reliability of systems and response processes, not to assign
individual blame.

## When a Postmortem Is Required

A postmortem is required for:

- Every incident recorded with `critical` or `warning` severity in the incident
  management system.
- Any incident that causes a material customer-facing outage or degradation,
  data loss or corruption, a security or privacy impact, or a significant
  financial or legal impact, regardless of its recorded severity.
- Any emergency production change, including an emergency rollback, taken to
  restore service when normal approval was unavailable.
- A recurrence of a previously documented incident or failure mode when the
  recurrence reveals that corrective actions were missing or ineffective.

An `info`-severity incident with no material impact does not require a
postmortem. The incident commander or service owner records the reason for
waiving a review in the incident record. A maintainer may require a postmortem
for any incident when the circumstances warrant one.

## Timing and Ownership

- The incident commander coordinates the review and ensures that the incident
  record links to the resulting postmortem.
- The affected service owner prepares the draft with input from responders and
  other affected teams. A person who was not directly responsible for the
  affected change or system reviews it where practical.
- Draft and review the postmortem within 48 hours of incident resolution, in
  line with the incident escalation guidance. If the impact or investigation
  makes that impractical, publish the known facts and initial actions within
  that window, record what remains unknown, and set a date for the completed
  review.

## Blameless Format

Use the following headings, adapting them as needed while retaining the
relevant facts:

1. **Summary** — what happened, when, and how it was resolved.
2. **Impact** — affected services and users, duration, and any data, security,
   financial, or legal consequences. State when an impact was not observed.
3. **Timeline** — detection, escalation, decisions, mitigations, and recovery,
   with timestamps in UTC.
4. **Causes and contributing conditions** — technical and organizational
   conditions that combined to produce or prolong the incident.
5. **Response assessment** — what helped, what hindered response, and where
   detection or recovery can improve.
6. **Corrective actions** — prioritized follow-up items with owners and due
   dates, tracked as specified below.

Describe decisions and system conditions, not personal fault. Do not name or
single out individuals as the cause. Focus on how the systems, safeguards,
information, and processes behaved and how they can be improved.

## Action-Item Tracking

- Each corrective action must describe a concrete outcome, have one accountable
  owner and a target due date, and be prioritized according to its risk
  reduction.
- Track each action in the project's issue tracker and link it from the
  postmortem. The postmortem alone is not the tracking mechanism.
- The incident commander ensures actions are filed before review closes; the
  service owner follows them through completion and verifies the intended
  improvement where practical.
- If an action is deferred, descoped, or its due date changes, update the
  tracking issue with the reason and revised plan. Keep actions open until the
  outcome is complete or an explicit decision to close it is recorded.

## Review

Review this policy when the incident severity model or incident response
process changes materially, or when a postmortem identifies a gap in these
requirements. Changes follow the governance process in `Governance/README.md`
and must remain within the `Governance/` folder.