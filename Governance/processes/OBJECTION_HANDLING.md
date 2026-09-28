# Objection-Handling Process

This document defines how an objection to a proposed decision — a lazy-consensus
proposal, a formal vote, or a governance change — is raised, how it is
resolved, and where it escalates if it cannot be resolved between the parties
involved. It exists so that disagreement has a predictable, respectful path
rather than stalling a decision indefinitely or being overridden without a
hearing.

This process is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## When This Applies

This process applies to an objection raised against:

- A proposal under lazy consensus (`Governance/processes/LAZY_CONSENSUS.md`).
- A formal vote in progress (`Governance/processes/FORMAL_VOTING.md`).
- A nomination (`Governance/processes/NOMINATION.md`).
- Any other governance decision open for comment, including a pull request
  that changes the `Governance/` folder itself.

It does not replace ordinary code-review feedback on application code, which
is resolved through the normal pull-request review flow.

## How Objections Are Raised

- An objection is raised as a comment on the issue, pull request, or vote
  thread the decision lives in — not in a side channel — so it is visible to
  everyone participating and becomes part of the versioned record.
- An objection must be **specific and actionable**: it states what concern
  the objector has and, where possible, what change would resolve it. "I
  don't like this" without a reason is feedback, not a blocking objection,
  and does not by itself pause the decision.
- An objection is raised by anyone with standing to participate in the
  decision it targets (see the relevant process — for example, only current
  maintainers can object to a formal vote's outcome, but anyone may object
  to a lazy-consensus proposal during its comment window).
- The objector should raise their objection as early as possible within the
  decision's open window; an objection raised after a decision has already
  closed is handled as a request to reopen (see Escalation Path), not as a
  block on the original window.

## Resolution Steps

1. **Acknowledge.** Whoever is driving the proposal (the author, or the
   maintainer running the vote) acknowledges the objection within a few days
   and confirms they understand the concern.
2. **Discuss.** The objector and the proposal's driver discuss the concern on
   the same thread, aiming for a change to the proposal that resolves it —
   most objections are resolved at this stage by a revision.
3. **Revise or withdraw.** If the concern is valid, the proposal is revised
   and, where the process it falls under requires it, the open window
   restarts for the revised version. If the objector is satisfied without a
   revision, they say so on the thread and the objection is marked resolved.
4. **Impasse.** If discussion does not resolve the concern within a
   reasonable time (guided by the underlying process's own timeline — for
   example, lazy consensus's minimum waiting period), either party may invoke
   the escalation path below rather than letting the decision stall
   indefinitely.

An unresolved, specific objection blocks lazy consensus by design (see
`Governance/processes/LAZY_CONSENSUS.md`) — this is what distinguishes lazy
consensus from a simple timeout. A formal vote is not blocked by a single
objection, but every objection raised during a vote is recorded and answered
before the result is finalised.

## Escalation Path

- If the objector and the proposal's driver cannot reach agreement, either
  may ask a maintainer who is not involved in the proposal to mediate.
- The mediating maintainer reviews the thread, may ask clarifying questions
  of both parties, and proposes a resolution. Mediation aims for a decision
  within 14 days of being invoked.
- If mediation does not resolve it, the matter is escalated to a formal vote
  among current maintainers (`Governance/processes/FORMAL_VOTING.md`), which
  produces a binding outcome.
- Every escalation and its outcome is recorded in
  `Governance/DECISION_LOG.md`, so the resolution — and the reasoning behind
  it — stays part of the project's versioned history.

Objections and their resolution must at all times assume good faith on both
sides; this process exists to surface and resolve genuine disagreement, not
to punish either raising or receiving an objection.

## Review

This process is reviewed whenever the decision-making processes it supports
change materially. Changes are proposed through the normal governance process
described in `Governance/README.md` and must touch only the `Governance/`
folder.
