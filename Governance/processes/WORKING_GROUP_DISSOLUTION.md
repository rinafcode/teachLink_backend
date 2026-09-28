# Working Group Dissolution

Version: 1.0
Last updated: 2026-09-25

## Purpose

This document defines the process for dissolving a Working Group in the
TeachLink Backend project. It ensures that dissolution is deliberate and
auditable, that all artifacts are handed over to a named owner, and that
records are archived so the project retains institutional knowledge after the
group is wound down.

A Working Group is a time-boxed or standing body granted authority over a
specific domain (for example security, payments, or documentation). Dissolution
is not a disciplinary action; it is a normal lifecycle event that happens when
a group has fulfilled its mandate, when its scope has been absorbed elsewhere,
or when it can no longer operate effectively.

## Scope

- Applies to every Working Group chartered under `Governance/CHARTER.md`.
- Covers voluntary dissolution (mandate complete or scope reassigned) and
  involuntary dissolution (quorum failure or inactivity).
- The dissolution record and all transferred artifacts remain within
  `Governance/` or the designated domain area; this process makes no changes
  to application code.

## Dissolution Triggers

A Working Group may be dissolved when **any one** of the following conditions
is met:

1. **Mandate fulfilled.** The group has delivered its defined outputs and the
   maintainers agree the mandate is complete. This is the expected, healthy
   outcome for time-boxed groups.

2. **Scope absorbed.** The group's domain has been merged into another Working
   Group or directly into maintainer responsibilities, making the group
   redundant.

3. **Voluntary wind-down.** All active members agree in writing (on the
   relevant GitHub issue or discussion) that the group should close.

4. **Quorum failure.** The group falls below the minimum membership required
   by its charter for more than 60 consecutive days and cannot recruit to
   restore quorum.

5. **Sustained inactivity.** The group has produced no recorded output and
   held no meetings for 90 or more consecutive days, and the members have not
   responded to a maintainer notification within 14 days of it being sent.
   See `Governance/policies/INACTIVITY.md` for the notification procedure.

6. **Maintainer decision.** The maintainers, by consensus or by the lead
   maintainer's deciding vote, resolve that the group no longer serves the
   project's interests. The reason must be recorded in the dissolution record.

## Dissolution Process

### Step 1 — Raise a dissolution proposal

A maintainer or Working Group member opens a GitHub issue titled
`Dissolution: <Group Name>` with the following information:

- The group being proposed for dissolution.
- The trigger condition(s) from the list above.
- The proposed effective date (minimum 14 days from the issue date, unless
  trigger 3 or 6 applies and all affected parties agree to a shorter window).
- A preliminary list of artifacts to be transferred or archived.

The maintainers apply the `governance` and `working-group` labels to the issue.

### Step 2 — Notification and objection window

- The issue is shared with all Working Group members and with the broader
  contributor community via the project's standard communication channels.
- A 14-day window opens for members and affected contributors to raise
  concerns or propose alternatives (reassignment, restructuring, or a formal
  hiatus instead of dissolution).
- Concerns must be specific and actionable. A general objection without a
  proposed alternative does not block dissolution.
- If a viable alternative is agreed within the window, dissolution is paused
  and the issue is updated to reflect the new plan.
- Trigger 3 (unanimous voluntary wind-down) and trigger 6 (maintainer
  decision already recorded) may proceed with a shortened window of 7 days if
  all members consent.

### Step 3 — Artifact inventory

Before the effective date the outgoing group lead (or a designated maintainer
if there is no active lead) produces a written artifact inventory on the
dissolution issue listing:

- All documents owned by the group (specifications, runbooks, governance
  records, decision logs).
- All open issues and pull requests under the group's remit.
- Any service accounts, credentials, or infrastructure the group managed.
- Any recurring obligations (scheduled reviews, external relationships,
  vendor contacts).

Each item must be assigned a **receiving owner** — a named maintainer, another
Working Group, or a designated repository area.

### Step 4 — Artifact handover

Artifact handover is completed before the effective date or, where external
dependencies prevent it, within 30 days after:

- **Documents.** Governance and process documents are moved or linked to their
  receiving owner's area within `Governance/`. Domain-specific documentation
  is moved to the appropriate `docs/` path or the receiving group's area.
  Ownership metadata (CODEOWNERS entries, front-matter headers) is updated.

- **Open issues and pull requests.** Reassign to the receiving owner. Add a
  comment on each item explaining the handover context and the dissolution
  reference issue number.

- **Service accounts and credentials.** Transfer ownership to the receiving
  maintainer or the platform/security team per the offboarding procedure in
  `Governance/processes/OFFBOARDING.md`. Rotate any credentials the group
  held exclusively.

- **Recurring obligations.** Document each obligation in the relevant runbook
  or `docs/` area and confirm with the receiving owner in writing on the issue.

No artifact may be deleted until the maintainers confirm that a receiving owner
has accepted it or that it has no continuing value (recorded on the dissolution
issue).

### Step 5 — Archival

On or after the effective date:

1. Create a dissolution record file at
   `Governance/processes/records/dissolution-<group-slug>-<YYYY-MM-DD>.md`
   using the template in the appendix below. The record documents the trigger,
   effective date, members at dissolution, artifact inventory, and receiving
   owners.

2. Update or remove the group's entry in any Working Group registry or index
   within `Governance/` to reflect its dissolved status and link to the record.

3. Archive the group's GitHub team (set to read-only or remove as appropriate
   for the organization's settings) and record the action in the dissolution
   record.

4. Close the dissolution issue with a link to the record file.

5. If the group maintained a dedicated communication channel (Slack, Discord,
   or similar), archive it rather than delete it, and post a final message
   linking to the dissolution record.

### Step 6 — Verification

Within 14 days of archival the lead maintainer or a designated maintainer
confirms:

- All artifacts in the inventory have a recorded receiving owner.
- No orphaned open issues, pull requests, or credentials remain under the
  dissolved group.
- The dissolution record is complete and merged into `Governance/`.
- Any required credential rotation has been completed and verified.

Verification is recorded as a comment on the now-closed dissolution issue and
in the dissolution record.

## Timeline Summary

| Phase                      | Duration                     |
| -------------------------- | ---------------------------- |
| Proposal raised            | Day 0                        |
| Objection window           | Days 0–14 (7 days, triggers 3 & 6) |
| Artifact inventory due     | Before effective date        |
| Artifact handover due      | By effective date (or +30 days for external dependencies) |
| Archival                   | On or after effective date   |
| Verification               | Within 14 days of archival   |

## Dissolution Record Template

Create `Governance/processes/records/dissolution-<group-slug>-<YYYY-MM-DD>.md`
with the following structure:

```markdown
# Dissolution Record — <Working Group Name>

Effective date: YYYY-MM-DD
Recorded by: <maintainer GitHub handle>

## Trigger

<State the trigger condition(s) and a brief explanation.>

## Members at Dissolution

- @handle — role
- @handle — role

## Artifact Inventory and Receiving Owners

| Artifact | Type | Receiving Owner | Notes |
| -------- | ---- | --------------- | ----- |
| ...      | ...  | ...             | ...   |

## Credential Rotation

<Confirm each credential rotation completed, or state N/A.>

## Verification

Verified by: <maintainer handle>
Verified on: YYYY-MM-DD
Outstanding items: <none, or list with tracking links>

## References

- Dissolution issue: #<issue number>
```

## Exceptions

Any deviation from this process (for example an expedited timeline due to a
security incident) must be approved in writing by the lead maintainer and at
least one other maintainer, with the reason documented in the dissolution
record.

## Related documents

- `Governance/CHARTER.md` — defines Working Group authority and chartering
- `Governance/processes/OFFBOARDING.md` — individual access revocation and
  credential handover procedures
- `Governance/policies/INACTIVITY.md` — inactivity thresholds and notification
  procedure that may trigger dissolution
- `Governance/policies/REVOCATION.md` — privilege revocation (relevant when
  dissolution follows a conduct issue)
- `Governance/README.md` — overall governance folder structure

## Change log

- 1.0 (2026-09-25): Initial version — adds working group dissolution procedure
  to Governance/processes.
