# Supermajority Policy

This document defines which decisions in the TeachLink Backend project
require a supermajority rather than a simple majority, the threshold that
applies, and how it is calculated. It exists so that the project's most
consequential decisions — the ones hardest to reverse — need broader support
than an ordinary vote.

This policy is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Which Decisions Require A Supermajority

A supermajority is required for:

- Amending the project charter (`Governance/CHARTER.md`) or this policy
  itself.
- Removing a maintainer's privileges through the revocation policy
  (`Governance/policies/REVOCATION.md`), where that policy calls for a
  formal vote rather than a unilateral decision.
- Changing the voting quorum (`Governance/policies/QUORUM.md`) or the formal
  voting process itself (`Governance/processes/FORMAL_VOTING.md`).
- Accepting an RFC that a maintainer flags, when opening the vote, as having
  an unusually large or hard-to-reverse blast radius (for example, a
  breaking change to the public API with no migration path).
- Any decision a governance document explicitly names as requiring a
  supermajority.

Every other formal vote — including ordinary RFC acceptance, routine role
nominations, and most governance changes decided by lazy consensus — uses a
simple majority (or, for lazy consensus, the absence of an unresolved
objection) rather than this higher bar.

## Threshold

A supermajority decision passes with **at least two-thirds of votes cast**
in favour (For ≥ 2 × Against, equivalently), and only when the higher quorum
`Governance/policies/QUORUM.md` sets for supermajority decisions
(two-thirds of currently eligible voters) is also met. Both conditions must
hold — reaching quorum with only a simple majority in favour is not
sufficient, and a lopsided vote among too few participants does not meet
quorum.

Abstentions are counted toward quorum (participation) but not toward the
two-thirds threshold itself, matching how quorum and outcome are separated
in `Governance/processes/FORMAL_VOTING.md`.

## How It Is Calculated

- The denominator for the two-thirds threshold is **votes cast** (For +
  Against), not the full pool of eligible voters — abstentions and
  non-responses are excluded from the threshold calculation, though
  non-responses still count against reaching quorum in the first place.
- The result is rounded in favour of the higher bar: a fractional
  requirement (for example, 2 of 3 votes cast) rounds *up* to the next whole
  vote needed in favour, never down.
- Worked example: 9 eligible voters, quorum of 6 reached, 7 votes cast (2
  abstain). Two-thirds of 7 is 4.67, rounded up to 5 — at least 5 of the 7
  cast votes must be For for the decision to pass.
- The maintainer running the vote states the exact numbers (eligible voters,
  quorum required, votes cast, threshold required, votes achieved) in the
  closing comment, so the calculation is auditable rather than asserted.

## Review

This policy is reviewed whenever the quorum or formal-voting processes it
depends on change materially. Changes to this policy are themselves subject
to the supermajority requirement it defines. Changes are proposed through
the normal governance process described in `Governance/README.md` and must
touch only the `Governance/` folder.
