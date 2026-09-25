# ADR Template

This is the template every Architecture Decision Record (ADR) in the
TeachLink Backend project starts from. An ADR records a technical decision
**that has already been made** — the decision, the reasoning, and the
alternatives considered — kept short enough that a future contributor can
read it in a few minutes.

This document is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code. Usage of this template is governed by
`Governance/processes/ADR_PROCESS.md`.

## How To Use This Template

Copy the section below into a new file at `Governance/adr/ADR-NNNN-short-title.md`
using the numbering scheme below, open it as a pull request against
`Governance/adr/`, and fill in every section. An ADR is deliberately short —
a page or two; detailed design belongs in the RFC that preceded it (where
one exists) or in the code's own documentation, not duplicated here.

---

## Template

```markdown
# ADR-NNNN: <Title of the decision>

- **Status:** Proposed | Accepted | Superseded by ADR-MMMM | Deprecated
- **Date:** <YYYY-MM-DD>
- **Author(s):** <GitHub handle(s)>
- **Related RFC:** <link, if this ADR follows an Accepted RFC>

## Context

The situation and constraints that led to needing this decision. What
problem existed, what forces were in tension, what would happen if no
decision were made.

## Decision

What was decided, stated plainly in one or two sentences. Avoid hedging —
this section is the record of what the project actually committed to.

## Alternatives Considered

What else was on the table, and why it lost. At least one real alternative,
even for a decision that felt obvious in hindsight.

## Consequences

What becomes easier or harder as a result. Include tradeoffs accepted
knowingly, not just the benefits — a consequences section that only lists
upsides has not been thought through.
```

## Status Values

- **Proposed** — the ADR is open for review (see
  `Governance/processes/ADR_PROCESS.md` for the lifecycle this maps to).
- **Accepted** — merged and in effect. This is the terminal, expected state
  for most ADRs.
- **Superseded by ADR-MMMM** — a later ADR replaced this decision. The text
  of the original ADR is not rewritten; only the status line changes, and it
  links to the ADR that replaced it.
- **Deprecated** — the decision no longer applies (e.g. the feature it
  concerned was removed) but was not replaced by a different decision.

Status is the one part of an ADR that may be edited after merge — everything
else is treated as an immutable historical record, per
`Governance/processes/ADR_PROCESS.md`.

## Numbering Scheme

- ADRs are numbered sequentially, zero-padded to four digits
  (`ADR-0001`, `ADR-0002`, ...), assigned in the order the ADR's pull request
  is opened — not the order it is merged.
- The number is permanent once assigned, even if the ADR is later
  superseded or deprecated; numbers are never reused.
- The next number to use is one greater than the highest existing file under
  `Governance/adr/` at the time the new ADR's pull request is opened. Two
  ADRs opened concurrently that land on the same number are resolved at
  review time by renumbering the one merged second.

## Review

This template is reviewed whenever the ADR process itself changes
materially. Changes are proposed through the normal governance process
described in `Governance/README.md` and must touch only the `Governance/`
folder.
