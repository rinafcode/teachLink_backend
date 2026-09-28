# Meeting Agenda Template

This is the template used to prepare the agenda for any synchronous TeachLink
Backend maintainer or governance meeting. An agenda published before a meeting
is what lets participants arrive prepared, keeps the discussion inside the time
available, and gives the meeting a shape that the minutes
(`Governance/templates/MINUTES_TEMPLATE.md`) can then be recorded against.

This document is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application code.

## When An Agenda Is Required

An agenda is prepared for any meeting where project business is conducted or a
decision might be made — a regular maintainer sync, a working-group meeting, or
a call convened to resolve an escalated objection
(`Governance/processes/OBJECTION_HANDLING.md`). An informal, no-agenda chat does
not need one; if it turns into project business, it should be given an agenda and
minuted.

## Standard Agenda Sections

Every agenda uses the same sections, in this order:

1. **Call to order & attendance** — who is present, who is absent, and whether
   the meeting is quorate for any vote on the agenda
   (`Governance/policies/QUORUM.md`).
2. **Review of previous actions** — the action items carried over from the
   previous meeting's minutes, each marked done or still open with an owner.
3. **Decision items** — matters that require a decision in this meeting. Each
   item states the question, the options, and the decision rule that applies
   (consensus, lazy consensus, or a formal vote).
4. **Discussion items** — matters that need discussion but not a decision today
   (for example, an RFC in progress, `Governance/processes/RFC_PROCESS.md`).
5. **Announcements** — short factual updates with no discussion expected.
6. **Next meeting & close** — confirm the next date and any items deferred to it.

Sections with nothing to cover are kept and marked "none" rather than dropped,
so the meeting keeps the same shape every time and the minutes line up with the
agenda section by section.

## Time-Boxing Guidance

The facilitator assigns a time box to every section before the meeting and keeps
the meeting to it. Default boxes, adjusted up or down by the facilitator when
publishing the agenda:

| Section | Default box |
| --- | --- |
| 1. Call to order & attendance | 5 min |
| 2. Review of previous actions | 10 min |
| 3. Decision items | 15 min per decision item |
| 4. Discussion items | 10 min per discussion item |
| 5. Announcements | 5 min total |
| 6. Next meeting & close | 5 min |

- **Decision items get the bulk of the time.** A decision item that is not
  converging within its box is either explicitly extended — the extension is
  recorded in the minutes — or deferred, with the deferral recorded as a
  parking-lot item on the next agenda.
- **Discussion items are not allowed to become decisions by accident.** If a
  discussion item needs a decision, it moves to the decision section of the next
  agenda with the relevant decision rule.
- **Announcements are not discussed.** A question raised under announcements is
  captured as a parking-lot item and taken on the next agenda.
- **Parking lot.** Items that overrun or arrive without a slot are written to a
  parking lot at the end of the agenda; nothing is lost, and nothing silently
  extends the meeting past its close.

## How Items Are Submitted

- **Who may submit.** Any contributor or maintainer may submit an agenda item.
- **How.** Submit an item by commenting on the meeting issue for the date in
  question, or by opening an issue that describes the item. If the repository
  does not yet have a meeting issue, open one titled
  `Agenda: <Meeting name> — <YYYY-MM-DD>`.
- **When.** Items are due **at least 24 hours before the meeting starts** so the
  facilitator can order them and publish the agenda.
- **What to include.** A one-line title, whether it is a **decision item** or a
  **discussion item**, and a link to the relevant issue, RFC, or ADR. A decision
  item that proposes a change should link the pull request or RFC that describes
  it.
- **Late items.** Items submitted inside the 24-hour window are taken if time
  allows after the published items, or deferred to the next agenda; the
  facilitator records which.
- **Publishing.** The facilitator compiles the submitted items into the sections
  above, assigns time boxes, and posts the finished agenda as a comment on the
  meeting issue before the meeting starts.

## The Template

Copy the section below into the meeting issue (or
`Governance/agenda/<YYYY-MM-DD>-<meeting-name>.md`) and fill in every section:

```markdown
# Agenda: <Meeting name> — <YYYY-MM-DD> — <HH:MM UTC>

- **Facilitator:** <name/handle>
- **Minute-taker:** <name/handle>
- **Quorum required:** yes/no (see Governance/policies/QUORUM.md)

## 1. Call to order & attendance (5 min)

- **Present:** <names/handles>
- **Absent:** <names/handles>
- **Quorate for votes on this agenda:** yes/no

## 2. Review of previous actions (10 min)

| Action | Owner | Due | Status |
| --- | --- | --- | --- |
| <item from last minutes> | <who> | <date, or "next meeting"> | done / open |

## 3. Decision items

### 3.1 <One-line question> (15 min)

- **Decision rule:** consensus | lazy consensus | formal vote
- **Context link:** <issue / RFC / ADR>
- **Options:**
  1. <option>
  2. <option>
- **Decision:** <left blank on the agenda; recorded in the minutes>

## 4. Discussion items

### 4.1 <Topic> (10 min)

- **Context link:** <issue / RFC>
- **Outcome:** <summary of the discussion — not a decision>

## 5. Announcements (5 min)

- <short factual update>

## 6. Next meeting & close (5 min)

- **Next meeting:** <date/time, or "not scheduled">
- **Deferred items:** <items carried to the next agenda>

## Parking lot

- <item that overran or arrived without a slot, with its owner>
```

## Relationship To The Minutes

Agenda section numbering matches the meeting minutes template
(`Governance/templates/MINUTES_TEMPLATE.md`) so the minute-taker can move through
the meeting section by section. A decision recorded in the minutes is appended to
`Governance/DECISION_LOG.md` within a few days of the meeting, and a decision
that required quorum or a formal vote follows `Governance/policies/QUORUM.md` and
`Governance/processes/FORMAL_VOTING.md` exactly as it would asynchronously — an
agenda item does not lower the bar for what counts as a valid decision.

## Review

This template is reviewed whenever the decision-making processes it supports
change materially. Changes are proposed through the normal governance process
described in `Governance/README.md` and must touch only the `Governance/` folder.
