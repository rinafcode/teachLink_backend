# Roadmap Governance Process

**Document:** `Governance/processes/ROADMAP_GOVERNANCE.md`
**Status:** Active
**Last Updated:** 2026-09-28
**Owner:** Maintainer Team

---

## Purpose

This document defines how the TeachLink Backend public roadmap is proposed, approved, updated, and communicated. A transparent roadmap process helps contributors understand where the project is heading and how they can align their contributions with strategic priorities.

---

## Scope

This process applies to all roadmap planning activities for `rinafcode/teachLink_backend`.

---

## What Is the Roadmap?

The roadmap is the set of prioritised themes, features, and improvements planned for future milestones. It is not a binding delivery commitment — it is a directional guide that reflects current priorities.

The roadmap lives as a GitHub project board and/or a `Governance/ROADMAP.md` file (updated quarterly). Both surfaces must stay in sync.

---

## Roadmap Proposal Process

### Who Can Propose Roadmap Items

Any contributor or maintainer may propose a roadmap item by:

1. Opening a GitHub issue labelled `type: feature` or `type: improvement` and `needs: discussion`.
2. Describing the problem, proposed solution, and expected impact.
3. Optionally proposing which milestone or quarter it belongs to.

### Proposal Review

Proposals are reviewed by maintainers during the **quarterly roadmap session** (see cadence below). Between sessions, high-impact proposals may be fast-tracked at the project lead's discretion.

Proposal outcomes:

| Outcome | Action |
|---|---|
| **Accepted** | Added to roadmap with a target milestone; issue labelled `status: triaged` |
| **Deferred** | Acknowledged but not scheduled; labelled `status: on hold` |
| **Declined** | Closed with a clear explanation of why it is out of scope |

---

## Approval Process

Roadmap items are approved by the following quorum:

| Decision type | Required approvers |
|---|---|
| Add or remove a roadmap item | Project lead + 1 maintainer |
| Change the target milestone of an existing item | Any 1 maintainer |
| Publish a new quarterly roadmap | Project lead |
| Archive a past roadmap item | Any 1 maintainer |

All roadmap approval decisions must be documented as a comment on the associated issue or as a commit to `Governance/ROADMAP.md`.

---

## Roadmap Cadence

| Activity | Frequency | Owner |
|---|---|---|
| Quarterly roadmap planning session | Once per quarter (first week of Jan, Apr, Jul, Oct) | Project Lead |
| Roadmap review and update | Monthly (first Monday) | Maintainer team |
| Roadmap published / communicated to community | After quarterly session | Project Lead |
| Individual item status update | When milestone is opened or closed | Assigned maintainer |

---

## Roadmap Communication

After each quarterly roadmap session, the project lead must:

1. Update `Governance/ROADMAP.md` (if it exists) with the new set of priorities.
2. Post a summary in the [Telegram community](https://t.me/teachlinkOD).
3. Optionally publish a GitHub Discussions post for broader visibility.

The communication must include:

- Themes and features targeted for the upcoming quarter.
- Any items removed or deferred from the previous quarter and why.
- How contributors can get involved (which issues are open for pickup).

---

## Roadmap Structure

Each roadmap entry should capture:

| Field | Description |
|---|---|
| **Title** | Brief, descriptive name of the item |
| **Status** | `Planned` / `In Progress` / `Completed` / `Deferred` |
| **Target milestone/quarter** | When it is expected to be worked on |
| **Priority** | `High` / `Medium` / `Low` |
| **Issue link** | Link to the GitHub issue |
| **Owner** | Assigned maintainer or `unassigned` |
| **Description** | 1–3 sentence explanation of the problem and value |

---

## Changing the Roadmap

The roadmap may be updated at any time, but changes must follow the approval requirements above. Ad-hoc changes between quarterly sessions must be documented with a reason.

Roadmap items must not be silently removed. Any removal must include a comment on the associated issue explaining the decision.

---

## Roles and Responsibilities

| Role | Responsibility |
|---|---|
| **Project Lead** | Sets strategic direction; approves quarterly roadmap; communicates roadmap publicly |
| **Maintainer** | Reviews proposals; manages milestone assignments; updates roadmap entries |
| **Contributor** | Proposes items; picks up roadmap issues; keeps assigned items progressing |

---

## Related Documents

- `Governance/processes/MILESTONE_GOVERNANCE.md` — How milestones are created and managed
- `Governance/processes/TRIAGE.md` — How new issues are triaged into the roadmap
- `Governance/LABEL_TAXONOMY.md` — Labels used in roadmap proposals
- `CONTRIBUTING.md` — General contribution guidelines
