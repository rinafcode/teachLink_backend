# Status Update Template

This is the template every status update in the TeachLink Backend project
starts from. A status update gives stakeholders a consistent, predictable
snapshot of progress without requiring them to read commit history or
attend a meeting.

This document is part of the project's **Reporting** area. It lives entirely
inside the `Governance/` folder and does not change application code.

## How To Use This Template

Copy the section below into the update's own file under
`Governance/reporting/`, or into the tracking issue it belongs to, and fill
in every section. An update that has nothing new since the last one should
still say so — silence is not a status.

---

## Template

```markdown
# Status Update: <Initiative or Workstream>

- **Date:** <YYYY-MM-DD>
- **Author:** <GitHub handle>
- **Reporting cadence:** <weekly | biweekly | monthly>
- **Overall status:** On track | At risk | Blocked

## Progress

What has been completed since the last update, written as finished outcomes
("migrated the billing worker to the new queue"), not activity ("worked on
the billing worker"). One bullet per outcome.

## Next Steps

What the next update is expected to show, in the order it will be tackled.
Each item must be small enough that a reader can tell whether it is done by
the next update.

## Blockers

Everything currently preventing progress, including decisions or reviews
being waited on. Name the person or group the blocker is waiting on and how
long it has been waiting. Write "None" when there are none — do not omit
the section.

## Reporting Cadence

Updates are published on the cadence stated above. If an update is missed,
the next one must include what changed during the gap.
```

## Section Guidance

- **Progress** — completed outcomes only; anything still in flight belongs
  under **Next Steps**.
- **Blockers** — every blocker names who it waits on; a blocker with no
  owner is a task, not a blocker.
- **Overall status** — `At risk` when a next step is in danger of slipping;
  `Blocked` only when progress has actually stopped.
