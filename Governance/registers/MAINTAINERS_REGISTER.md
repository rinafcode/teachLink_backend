# Maintainers Register

This register lists everyone who currently holds maintainer status in the
TeachLink Backend project, the areas they are responsible for, and whether
they are active or emeritus. It is the authoritative answer to "who can
approve this change" and the input to onboarding and offboarding.

This document is part of the project's **Roles** area. It lives entirely
inside the `Governance/` folder and does not change application code.
Admission follows `Governance/processes/NOMINATION.md` and
`Governance/processes/PROMOTION_CRITERIA.md`; departure follows
`Governance/processes/OFFBOARDING.md`.

## Maintainer Fields

Each entry in the register carries these fields:

| Field | Meaning |
|---|---|
| Handle | GitHub handle of the maintainer. |
| Area | The domains they are responsible for (e.g. API, infrastructure, governance). |
| Status | Active or Emeritus. |
| Since | Date maintainer status was granted. |
| Last active | Date of their most recent review, merge, or incident response. |

## Register

| Handle | Area | Status | Since | Last active |
|---|---|---|---|---|
| *(entries added on admission)* | | | | |

## Areas

- **Area** entries name one or more of the project's governance domains; a
  maintainer with no area is not listed as Active — every Active entry owns
  at least one area, so there is always someone to ask.
- Areas may overlap; overlap is deliberate for continuity, but no area may
  be covered only by Emeritus entries.

## Active And Emeritus Status

- **Active** — may review and merge changes in their areas, vote in
  maintainer decisions, and be counted for quorum.
- **Emeritus** — a former Active maintainer in good standing who stepped
  down or went inactive. Emeritus entries keep their historical record and
  their voice in discussion, but do not vote and are not counted for
  quorum.
- An Active entry that has had no activity for **six months** is proposed
  for Emeritus status through the normal review, with a comment on their
  last area of work; the proposal is not automatic, and the maintainer may
  simply confirm they remain Active.

## Update Process

1. **Admission or status change** — the change to this register is made in
   the pull request that completes the nomination or offboarding recorded
   under `Governance/processes/`, referencing that record.
2. **Regular verification** — the register is verified at every quarterly
   governance review (`Governance/runbooks/QUARTERLY_GOVERNANCE_REVIEW.md`):
   areas are checked against current work, and stale *Last active* values
   are refreshed.
3. **Between reviews** — any maintainer may propose an update through a
   normal pull request; entries are never edited silently, and every change
   to a Status field must link the decision that caused it.
