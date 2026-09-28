# Escalation Path

This process defines who responds to an incident, when responsibility moves to
the next escalation tier, and the acknowledgement expectations for each tier.
It governs the human response path; alert detection and notification delivery
are handled by the incident-management service.

## Scope and Contact Routing

This path applies to incidents affecting a TeachLink Backend service. The
service owner recorded in
[`../domains/SERVICE_OWNERSHIP.md`](../domains/SERVICE_OWNERSHIP.md) is the
authoritative source for the current primary and secondary contacts. Use the
service's ownership record and on-call rotation to identify the people holding
those roles; this process does not duplicate names or personal contact details.
Services without a dedicated rotation use the general maintainer rotation,
except services handling payments, authentication, or personal data, which
must have named on-call owners.

Incidents are handled in the incident channel. Notification channels and retry
behavior follow the severity policy configured by
`NotificationAndEscalationService`; a change to those settings is made in the
service and reviewed with the corresponding code change. For critical
incidents, the configured channels include PagerDuty, email, and Slack.

## Escalation Tiers and Response SLAs

The acknowledgement window is measured from the time a tier is notified. The
incident's severity determines the window at every tier:

| Severity | Acknowledgement window |
| --- | --- |
| Critical | 1 minute |
| Warning | 3 minutes |
| Info | 5 minutes |

| Tier | Contact | Responsibility and escalation trigger |
| --- | --- | --- |
| **T1 — Primary on-call** | Primary owner of the affected service | Acknowledge and lead initial triage. Every incident starts here. If not acknowledged within the severity window and configured retries, escalate to T2. |
| **T2 — Secondary on-call** | Secondary owner of the affected service | Take over response when T1 is unavailable or has not acknowledged. If T2 is not acknowledged within the severity window and configured retries, escalate to T3. |
| **T3 — On-duty maintainer** | Maintainer on duty | Coordinate cross-service investigation or take over when T2 is unavailable. If T3 is not acknowledged within the severity window, or the incident is project-wide, escalate to T4. |
| **T4 — Full maintainer group** | Maintainers through the incident channel | Mobilize project-wide response when T3 is unavailable or the incident affects the project broadly. A maintainer takes incident command and coordinates further response. |

Acknowledgement means a responder has accepted responsibility for the incident;
it does not mean the incident is resolved. An acknowledged incident remains
with its responder while mitigation continues. Do not advance tiers solely
because an acknowledged incident is still active. A responder who cannot
continue must explicitly hand over to the next available tier and record the
handoff in the incident channel.

## Response and Handoff

1. Identify the affected service, severity, and primary owner from the incident
   record and service ownership mapping.
2. Notify T1 using the service's configured on-call route. The responder
   acknowledges the incident within the severity window, reviews the relevant
   runbook, and begins triage or mitigation.
3. If acknowledgement is not received within the window and configured retry
   period, notify the next tier. Continue through T2, T3, and T4 as needed;
   do not wait for the previous tier if it is known to be unavailable or the
   incident is project-wide.
4. The current incident lead keeps the incident channel updated with impact,
   actions, blockers, and any ownership handoff. Follow the applicable
   runbook and status-communication requirements.
5. Record resolution and follow-up actions. Incidents meeting the criteria in
   [`../domains/POSTMORTEM_POLICY.md`](../domains/POSTMORTEM_POLICY.md) require
   a blameless postmortem under that policy.

## Regression Tests Where Applicable

This is a governance-only documentation change. It adds no runtime behavior,
configuration, or executable code, so no regression test is applicable. Any
future change to notification routing, severity windows, retries, or escalation
behavior must update the relevant implementation and its tests in the same
change. This document must remain consistent with
[`../domains/ON_CALL.md`](../domains/ON_CALL.md) and the configured incident
escalation policy.

## Documenting Changes

Changes to this process are proposed through the normal governance process and
must remain within the `Governance/` folder. Update the version history below
when this document changes; review it whenever service ownership, incident
severity definitions, or escalation behavior changes, and at least annually.

| Version | Date | Description |
| --- | --- | --- |
| 1.0.0 | 2026-09-28 | Establishes the four-tier incident escalation path, role-based contacts, severity-based acknowledgement SLAs, and handoff expectations. |

## Related Documents

- [`../domains/ON_CALL.md`](../domains/ON_CALL.md) — on-call rotation and
  escalation governance.
- [`../domains/SERVICE_OWNERSHIP.md`](../domains/SERVICE_OWNERSHIP.md) —
  authoritative service owners and escalation contacts.
- [`../domains/POSTMORTEM_POLICY.md`](../domains/POSTMORTEM_POLICY.md) —
  postmortem criteria and follow-up requirements.
- [`../../docs/RUNBOOKS.md`](../../docs/RUNBOOKS.md) — operational mitigation
  steps.
