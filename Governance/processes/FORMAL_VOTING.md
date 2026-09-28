# Formal Voting Process

This document defines when a formal vote is required in the TeachLink Backend
project, who is eligible to vote, and how results are recorded. It is the
escalation path referenced by `Governance/processes/LAZY_CONSENSUS.md` and
`Governance/processes/OBJECTION_HANDLING.md` when a decision needs a binding,
explicit outcome rather than the absence of an objection.

This process is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## When A Formal Vote Is Required

A formal vote is required for:

- A decision escalated out of the objection-handling process
  (`Governance/processes/OBJECTION_HANDLING.md`) because mediation did not
  resolve it.
- Granting or revoking the Maintainer role, other than a routine inactivity
  transition already covered by `Governance/policies/INACTIVITY.md`.
- Amending the project charter (`Governance/CHARTER.md`) or this document
  itself.
- Any decision a governance document explicitly names as requiring a formal
  vote (for example, a supermajority decision under
  `Governance/policies/SUPERMAJORITY.md`, where one exists).
- Any decision the maintainers agree, by simple discussion, is significant
  enough to warrant one even though no document strictly requires it.

Decisions that can be made by lazy consensus (no one blocks within the
waiting period) do not need a formal vote unless an objection escalates
them here.

## Who Is Eligible To Vote

- Current **Maintainers**, as defined in `Governance/roles/MAINTAINER.md`,
  are eligible to vote on every formal vote.
- A maintainer on approved leave (`Governance/policies/INACTIVITY.md` §5) is
  still eligible but is not expected to participate; their absence does not
  reduce the eligible-voter count used for quorum
  (`Governance/policies/QUORUM.md`).
- A vote specifically about a role other than Maintainer (for example, a
  Treasurer decision under `Governance/roles/TREASURER.md`) may extend
  eligibility to that role's holder for that vote only, stated explicitly
  when the vote opens.
- A maintainer who is the direct subject of the vote (their own role
  change, a proposal they authored) may still vote, but is expected to
  disclose the conflict on the thread; their vote is counted the same as any
  other for quorum and outcome.

## How A Vote Is Run

1. **Open.** A maintainer opens the vote as a comment on the relevant issue
   or a new issue titled `Vote: <subject>`, stating the proposal, the
   eligible-voter basis, and the voting window (7 days by default, matching
   the objection-handling discussion window, unless the escalating process
   states otherwise).
2. **Cast votes.** Eligible voters record **For**, **Against**, or
   **Abstain** as a comment on the thread, with a reason encouraged but not
   required. Votes may be changed any time before the window closes by
   posting an updated comment.
3. **Close.** At the end of the window, the maintainer running the vote
   tallies the result and confirms whether quorum
   (`Governance/policies/QUORUM.md`) was reached.
4. **Outcome.** Absent a specific supermajority requirement, a vote passes
   with a simple majority of votes cast (For > Against; Abstain does not
   count toward either side). A tie fails to pass.

## How Results Are Recorded

- The maintainer running the vote posts a closing comment on the thread
  stating the final tally, whether quorum was met, and the outcome.
- The outcome is appended to `Governance/DECISION_LOG.md` with type `vote`
  and a link back to the vote thread, per that document's entry format.
- If the vote adopts or amends a governance document, the corresponding pull
  request references the vote thread in its description.
- A vote's record is never edited after the fact; a reversed decision is a
  new vote with its own new entry, per `Governance/DECISION_LOG.md`'s
  append-only rule.

## Review

This process is reviewed whenever the maintainer ladder or the quorum policy
changes materially. Changes are proposed through the normal governance
process described in `Governance/README.md` and must touch only the
`Governance/` folder.
