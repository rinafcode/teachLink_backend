# Working Group Charter Template

This is the template every Working Group charter in the TeachLink Backend
project starts from. A charter records the **mandate, scope, membership,
decision-making rules, and sunset condition** of a Working Group — the
minimum information needed for the rest of the project to understand what
the group is authorised to do, who is accountable, and when the group's
work is complete.

This document is part of the project's **Roles & membership** area. It lives
entirely inside the `Governance/` folder and does not change application code.
Dissolution of an active Working Group follows
`Governance/processes/WORKING_GROUP_DISSOLUTION.md`.

## How To Use This Template

Copy the section below into a new file at
`Governance/working-groups/<group-slug>/CHARTER.md` (for example
`Governance/working-groups/security/CHARTER.md`), open it as a pull request
limited to the `Governance/` folder, and fill in every section. Do not delete
a section because it feels premature — write "Not yet determined" or "N/A"
with a one-line reason so reviewers can see the field was considered.

A charter is deliberately short — one or two pages. Detailed design,
processes, and runbooks belong in the group's own working documents, not
duplicated here.

Once merged, the charter takes effect immediately. Any amendment follows
the process in the **Charter amendments** section below.

---

## Template

```markdown
# <Working Group Name> — Working Group Charter

- **Version:** <1.0>
- **Status:** Proposed | Active | Sunset
- **Created:** <YYYY-MM-DD>
- **Chair:** <GitHub handle>
- **Sponsor (maintainer):** <GitHub handle>
- **Last reviewed:** <YYYY-MM-DD>

## Purpose

One paragraph stating why this Working Group exists and what problem it is
solving for the TeachLink Backend project. Written so that a contributor who
has never encountered this group can understand its mission without reading
further.

## Scope

### In scope

What the Working Group IS responsible for. Use a short bulleted list of
domains, decisions, or artifacts the group owns:

- <domain or decision type the group owns>
- <domain or decision type the group owns>

### Out of scope

What the Working Group is explicitly NOT responsible for, to prevent scope
creep and clarify boundaries with other groups or maintainers:

- <area explicitly excluded>
- <area explicitly excluded>

Scope changes require a charter amendment (see **Charter amendments** below).

## Deliverables

Concrete, checkable outputs the Working Group is expected to produce. Each
deliverable has a target date (or a trigger event) and a named owner within
the group:

| Deliverable | Description | Target date / trigger | Owner |
| ----------- | ----------- | --------------------- | ----- |
| <name> | <one-line description> | <YYYY-MM-DD or event> | <handle> |
| <name> | <one-line description> | <YYYY-MM-DD or event> | <handle> |

Deliverables are updated by charter amendment as work progresses.

## Membership

### Roles

- **Chair** — facilitates meetings, publishes agendas and minutes, holds the
  deciding vote when the group cannot reach consensus, and is the primary
  contact for the maintainer sponsor. There is exactly one Chair at any time.
- **Member** — participates in discussions and decisions, owns deliverables
  as assigned, and upholds the group's commitments.
- **Maintainer sponsor** — a named maintainer who acts as the group's liaison
  to the maintainer body, escalates decisions the group cannot settle, and
  ensures the group's work is reflected in the project roadmap.

### Current members

| Handle | Role | Joined |
| ------ | ---- | ------ |
| <@handle> | Chair | <YYYY-MM-DD> |
| <@handle> | Member | <YYYY-MM-DD> |

### Joining and leaving

- **Joining.** Any contributor may request membership by commenting on the
  group's tracking issue. The Chair confirms acceptance and updates this
  charter by pull request.
- **Leaving.** A member may leave at any time by notifying the Chair. The
  Chair updates this charter by pull request. A member who is inactive for
  90 or more consecutive days without a recorded leave of absence is removed
  per `Governance/policies/INACTIVITY.md`.
- **Minimum membership.** The group requires at least two active members
  (including the Chair) to remain quorate. If membership falls below this
  threshold for more than 60 consecutive days the group enters the dissolution
  process defined in `Governance/processes/WORKING_GROUP_DISSOLUTION.md`.

## Decision-making

The Working Group uses **lazy consensus** for routine decisions: a proposal
posted to the group's designated channel (see **Communication** below) is
adopted if no member raises a blocking objection within five business days.

A **formal vote** is required for:

- Charter amendments.
- Adding or removing a member against their wishes.
- Any decision that affects code, configuration, or policy outside the
  `Governance/` folder.

Formal votes require a simple majority of active members. The Chair casts
a deciding vote only when votes are tied. Votes and their outcomes are
recorded in `Governance/DECISION_LOG.md` within five business days of the
decision.

Decisions that cannot be settled within the group are escalated to the
maintainer sponsor, who follows `Governance/processes/ESCALATION_PATH.md`.

## Meeting cadence and communication

- **Meetings.** <frequency — e.g. bi-weekly | monthly | as needed>. Agendas
  are published at least 24 hours before each meeting using
  `Governance/templates/AGENDA_TEMPLATE.md`. Minutes are published within
  five business days using `Governance/templates/MINUTES_TEMPLATE.md`.
- **Async channel.** <channel name and link — e.g. the GitHub Discussion
  category, a Telegram thread, or a dedicated issue label>.
- **Tracking issue.** All Working Group activity is anchored to a single
  GitHub issue titled `Working Group: <Working Group Name>` that the Chair
  keeps up to date.

## Reporting

The Chair posts a written status update to the tracking issue at the
cadence below. The maintainer sponsor reviews each update and surfaces
blockers to the maintainer body as needed.

| Report type | Cadence | Audience | Format |
| ----------- | ------- | -------- | ------ |
| Status update | <monthly / per milestone> | Maintainers + community | Comment on tracking issue |
| Deliverable sign-off | On completion of each deliverable | Maintainer sponsor | Pull request + tracking issue comment |
| Sunset or renewal report | At sunset trigger (see below) | Maintainers + community | Pull request to update charter status |

## Sunset clause

This Working Group dissolves — or must be formally renewed — when **any one**
of the following conditions is met:

1. **All deliverables accepted.** Every deliverable in the **Deliverables**
   table above has been accepted by the maintainer sponsor. This is the
   expected, healthy outcome.
2. **End date reached.** The group has operated for <duration — e.g. six
   months | one year> from its creation date without completing all
   deliverables. The group must either amend this charter to extend the
   timeline (with a rationale) or enter dissolution.
3. **Quorum failure.** Membership falls below the minimum defined in
   **Membership** for more than 60 consecutive days.
4. **Inactivity.** The group produces no recorded output and holds no
   meetings for 90 or more consecutive days, per
   `Governance/policies/INACTIVITY.md`.
5. **Maintainer decision.** The maintainers, by consensus or by the lead
   maintainer's deciding vote, determine the group no longer serves the
   project's interests.

When a sunset condition is triggered the Chair (or, if there is no active
Chair, the maintainer sponsor) opens a dissolution proposal following
`Governance/processes/WORKING_GROUP_DISSOLUTION.md`. The group's status in
this charter is updated to **Sunset** at that time.

## Charter amendments

This charter is amended through the standard governance process:

1. A pull request is opened that touches **only** the `Governance/` folder.
2. The proposed change is discussed and review comments are resolved by its
   author (`CONTRIBUTING.md` §9 *PR Review Policy*).
3. A formal vote of the Working Group members is held (see
   **Decision-making** above). Approval by a simple majority of active
   members is required before the maintainer sponsor merges the pull request.
4. The **Version** field in this charter's header is incremented and the
   **Last reviewed** field is updated on merge.

Minor editorial corrections (typos, broken links) may be merged by the
maintainer sponsor without a formal vote, provided no normative content
changes.

## Related documents

- `Governance/CHARTER.md` — project-level charter; defines Working Group authority
- `Governance/processes/WORKING_GROUP_DISSOLUTION.md` — dissolution process and record template
- `Governance/policies/INACTIVITY.md` — inactivity thresholds and notification procedure
- `Governance/policies/QUORUM.md` — quorum rules for formal votes
- `Governance/templates/AGENDA_TEMPLATE.md` — meeting agenda template
- `Governance/templates/MINUTES_TEMPLATE.md` — meeting minutes template
- `Governance/DECISION_LOG.md` — record of all formal decisions
```

## Status Values

- **Proposed** — the charter pull request is open for review. The Working
  Group does not have authority until the charter is merged.
- **Active** — the charter is merged and in effect. The group operates under
  the terms recorded here.
- **Sunset** — a sunset condition has been triggered. The group is in or has
  completed the dissolution process defined in
  `Governance/processes/WORKING_GROUP_DISSOLUTION.md`. The charter text is
  not deleted; only the status line changes, and the dissolution record is
  linked from it.

## Review

This template is reviewed whenever the Working Group lifecycle processes it
supports change materially. Changes are proposed through the normal governance
process described in `Governance/README.md` and must touch only the
`Governance/` folder.
