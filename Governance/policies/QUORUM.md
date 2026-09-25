# Voting Quorum Policy

This document defines the quorum required for a formal vote
(`Governance/processes/FORMAL_VOTING.md`) to produce a valid, binding result
in the TeachLink Backend project, how quorum is measured, and what happens
when it is not met.

This policy is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Why Quorum Matters

A vote decided by a small, unrepresentative fraction of eligible voters does
not reflect the project's judgment, even if every vote cast is unanimous.
Quorum sets a floor on participation so a formal vote's outcome carries the
weight of the maintainer group as a whole, not of whoever happened to be
available that week.

## Quorum Threshold

- Quorum for a formal vote is **at least half of currently eligible voters**
  (per `Governance/processes/FORMAL_VOTING.md`'s eligibility rule),
  rounded up — for example, 5 of 8 eligible maintainers.
- A vote whose subject is a **supermajority decision**
  (`Governance/policies/SUPERMAJORITY.md`, where one exists — for example,
  amending the charter or removing a maintainer) requires a higher quorum of
  **two-thirds of currently eligible voters**, rounded up, reflecting the
  greater weight of those decisions.
- The lead maintainer role referenced in `Governance/roles/MAINTAINER.md`
  does not carry a separate quorum weight — one eligible voter is one vote
  toward quorum, regardless of role, unless a specific process states
  otherwise.

## How Quorum Is Measured

- Quorum is measured against the list of currently eligible voters at the
  moment the vote **opens**, not at the moment it closes. A voter who becomes
  ineligible partway through the vote (e.g. an inactivity transition under
  `Governance/policies/INACTIVITY.md`) still counts toward the quorum
  denominator for that vote.
- A vote counts toward quorum whether it is in favour, against, or an
  explicit abstention recorded on the vote thread — quorum measures
  *participation*, not agreement. A voter who does not respond at all does
  not count.
- The maintainer running the vote (see `Governance/processes/FORMAL_VOTING.md`)
  is responsible for tallying participation against the eligible-voter list
  and stating explicitly, when the vote closes, whether quorum was reached.

## When Quorum Is Not Met

- A vote that closes without reaching quorum produces **no binding result**,
  regardless of how lopsided the votes actually cast were.
- The vote is reopened for a second round with an extended window (at least
  as long as the original window) and an explicit reminder to eligible
  voters who have not yet participated.
- If the second round also fails to reach quorum, the proposal is referred to
  the lead maintainer, who may extend the window once more, or record in
  `Governance/DECISION_LOG.md` that the vote lapsed for lack of quorum and
  that the status quo stands.
- A proposal that lapses for lack of quorum may be raised again later; it is
  not treated as rejected, only as undecided.

## Review

This policy is reviewed whenever the maintainer ladder or the formal-voting
process changes materially. Changes are proposed through the normal
governance process described in `Governance/README.md` and must touch only
the `Governance/` folder.
