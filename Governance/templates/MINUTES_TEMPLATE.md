# Meeting Minutes Template

This is the template used to record minutes for any synchronous TeachLink
Backend maintainer or governance meeting. It exists so that decisions made
in a live discussion are not lost to whoever happened to be in the room —
they get the same versioned treatment as a decision made asynchronously on
an issue thread.

This document is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## When Minutes Are Taken

Minutes are recorded for any meeting where a project decision might be
made or project business is conducted — a regular maintainer sync, a
one-off working-group meeting, or a call convened to resolve an escalated
objection (`Governance/processes/OBJECTION_HANDLING.md`). An informal,
no-agenda chat does not need minutes.

## Minutes Structure

Copy the section below for each meeting:

```markdown
# Minutes: <Meeting name> — <YYYY-MM-DD>

- **Attendees:** <names/handles>
- **Absent:** <names/handles, if relevant to quorum or a vote taken>
- **Facilitator:** <name/handle>
- **Minute-taker:** <name/handle>

## Agenda

1. <item>
2. <item>

## Discussion

Per agenda item, a short summary of what was discussed — enough for someone
who was not present to understand the context of any decision or action
item below, not a verbatim transcript.

## Decisions

Any decision reached, phrased the same way it would be phrased in
`Governance/DECISION_LOG.md` — one sentence, plus who made it (consensus in
the room, or a vote with a tally if `Governance/processes/FORMAL_VOTING.md`
applied).

## Action Items

| Action | Owner | Due |
| --- | --- | --- |
| <what needs to happen> | <who> | <date, or "next meeting"> |

## Next Meeting

<date/time, or "not scheduled">
```

## How Decisions And Action Items Are Recorded

- Every entry under **Decisions** is appended to `Governance/DECISION_LOG.md`
  by the minute-taker (or any maintainer) within a few days of the meeting,
  linking back to the minutes file — the decision log stays the single
  source of truth for outcomes, and the minutes provide the fuller context
  behind them.
- A decision that required quorum or a formal vote follows
  `Governance/policies/QUORUM.md` and
  `Governance/processes/FORMAL_VOTING.md` exactly as it would asynchronously
  — a meeting does not lower the bar for what counts as a valid decision.
- Action items are tracked to completion the same way any other project work
  is: as a GitHub issue where the work is non-trivial, or a follow-up
  comment on the relevant thread where it is small. The minutes are not the
  system of record for whether an action item is done — they are the record
  that it was assigned.

## Where Minutes Are Published

Minutes are published under `Governance/minutes/`, one file per meeting,
named `YYYY-MM-DD-<meeting-name>.md`, so they sort chronologically and stay
discoverable alongside the rest of governance. The `Governance/minutes/`
directory is created when the first set of minutes is recorded. Minutes are
never deleted, even for a meeting that produced no decisions — a record that
nothing was decided is still useful history.

## Review

This template is reviewed whenever the decision-making processes it
supports change materially. Changes are proposed through the normal
governance process described in `Governance/README.md` and must touch only
the `Governance/` folder.
