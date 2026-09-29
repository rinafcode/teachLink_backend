# TeachLink Backend Meeting Cadence

**Document:** `Governance/processes/MEETING_CADENCE.md`  
**Version:** 1.0.0  
**Status:** Active  
**Last Updated:** 2026-09-29  
**Owner:** Maintainer Team

---

## Purpose

This document sets a predictable baseline for recurring TeachLink Backend meetings, including their purpose, schedule, and attendance expectations. Meetings support coordination; they do not replace the project's asynchronous issue, pull request, and decision processes.

## Schedule and Meeting Types

Times are stated in UTC. The facilitator publishes the exact start time, duration, and connection details with the agenda. Meetings are remote by default.

| Meeting                             | Cadence                                                                      | Participants                                                                      | Purpose                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maintainer and roadmap sync**     | Monthly, on the first Monday                                                 | Maintainers; contributors may join relevant agenda items                          | Review open actions, project health, roadmap progress, and issues needing maintainer coordination. This is the monthly roadmap review described in [`ROADMAP_GOVERNANCE.md`](ROADMAP_GOVERNANCE.md).        |
| **Quarterly roadmap planning**      | Once per quarter, during the first week of January, April, July, and October | Project Lead and maintainers; working-group leads are invited for relevant topics | Set or refresh quarterly priorities and communicate roadmap decisions, following [`ROADMAP_GOVERNANCE.md`](ROADMAP_GOVERNANCE.md). This session may be combined with the monthly sync when dates are close. |
| **Working-group meeting**           | As needed, scheduled by the working-group lead                               | Relevant working-group members and invited contributors                           | Coordinate domain work or resolve a topic that benefits from synchronous discussion. Routine updates should remain asynchronous where practical.                                                            |
| **Incident or hotfix coordination** | As needed when an incident or urgent change requires it                      | Incident lead, relevant maintainers, and responders                               | Coordinate response and handoffs under the applicable incident, escalation, and hotfix procedures. This is not a substitute for required incident records or approvals.                                     |
| **Weekly backlog review**           | Every Monday; asynchronous by default                                        | Triage owners and maintainers                                                     | Review newly triaged issues and backlog priorities. Follow [`TRIAGE.md`](TRIAGE.md); hold a live call only when discussion is necessary.                                                                    |

The facilitator selects a time that gives expected participants reasonable notice across time zones and publishes it with the agenda. If a recurring date conflicts with a public holiday or an urgent incident, the facilitator may move that meeting within the same week, or cancel it and record the reason and any follow-up asynchronously.

## Attendance Expectations

- **Maintainers:** Make a reasonable effort to attend the monthly sync and quarterly planning session. If unable to attend, review the agenda and minutes asynchronously and add relevant input to the meeting issue or linked discussion.
- **Project Lead and working-group leads:** Attend sessions they own when possible, or arrange for a delegate to facilitate and carry forward decisions and actions.
- **Working-group members and contributors:** Attendance is optional unless they have accepted a specific agenda item, action, or response role. Contributors may propose agenda items and are welcome when the subject is relevant to their work.
- **Incident responders:** Follow the applicable incident response and on-call expectations; meeting attendance does not override those procedures.
- **All participants:** Respect the published agenda and time boxes, raise schedule or accessibility needs early, and keep discussion constructive. No contributor is expected to attend every meeting to remain in good standing.

Attendance at a meeting does not itself establish quorum or grant decision authority. Any vote, approval, or decision must meet the requirements of the applicable governance policy or process, including [`QUORUM.md`](../policies/QUORUM.md), [`FORMAL_VOTING.md`](FORMAL_VOTING.md), or [`LAZY_CONSENSUS.md`](LAZY_CONSENSUS.md), as relevant.

## Agenda, Minutes, and Follow-up

- The facilitator creates a meeting issue and publishes an agenda, with the exact UTC time, at least **7 days before** a recurring meeting when practicable. For a short-notice working-group or incident meeting, provide as much notice as circumstances allow.
- Agenda items are submitted at least **24 hours before** the meeting when practicable and follow [`AGENDA_TEMPLATE.md`](../templates/AGENDA_TEMPLATE.md). Late items may be deferred or included at the facilitator's discretion.
- A minute-taker records attendance, discussion outcomes, decisions, action owners, and due dates using [`MINUTES_TEMPLATE.md`](../templates/MINUTES_TEMPLATE.md). Publish minutes in `Governance/minutes/` for governance meetings; operational incident records follow their applicable procedures.
- Record decisions in [`DECISION_LOG.md`](../DECISION_LOG.md) and track material follow-up as issues. Apply the same approval and quorum requirements that would apply to an asynchronous decision.
- If a meeting is cancelled, the facilitator posts the cancellation and any needed follow-up on the meeting issue.

## Review and Changes

The Maintainer Team reviews this cadence at least annually, and sooner if team size, time zones, or project needs change materially. Proposed changes follow the governance contribution process in [`../README.md`](../README.md) and remain limited to the `Governance/` folder.
