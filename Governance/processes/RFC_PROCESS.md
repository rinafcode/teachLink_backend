# RFC Process

This document defines when an RFC (Request for Comments) is required in the
TeachLink Backend project, the lifecycle stages an RFC moves through, and the
criteria for accepting or rejecting one. An RFC is how a significant design
decision is proposed and reviewed before it is built, as distinct from an ADR
(`Governance/processes/ADR_PROCESS.md`), which records a decision that has
already been made.

This process is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## When An RFC Is Required

An RFC is required before starting work on:

- A new module or service boundary added to `src/` that other modules will
  depend on.
- A breaking change to a public API, database schema, or an existing
  module's contract that other consumers rely on.
- Adoption of a new architectural pattern (a new data store, a new
  cross-cutting concern like the queueing or caching layers) that other
  contributors will be expected to follow afterward.
- Any change a maintainer flags as significant enough to warrant broader
  input before implementation begins, even if it does not strictly meet the
  criteria above.

A change that is purely internal to one module, reversible, and does not
change a contract other code depends on does not need an RFC — normal pull
request review is sufficient. When in doubt, open a lightweight RFC; the
process is intentionally not gatekept behind a formal request to start one.

## RFC Lifecycle Stages

RFCs move through the following statuses, recorded in the metadata header
defined by `Governance/templates/RFC_TEMPLATE.md`:

1. **Draft.** The author is still filling in the template. A Draft RFC may be
   shared for early feedback but is not yet open for formal review.
2. **In Review.** The author has completed the template and requests review.
   The review checklist in `Governance/templates/RFC_TEMPLATE.md` is applied,
   and the RFC is open for comment for at least 7 days (matching
   `Governance/processes/LAZY_CONSENSUS.md`'s window for substantive
   changes, where that process exists), longer for a large or contentious
   proposal.
3. **Accepted.** The RFC reaches a decision to proceed — by lazy consensus
   (no unresolved objection after the review window) or, for a
   supermajority-scoped RFC (see `Governance/policies/SUPERMAJORITY.md`), by
   formal vote. Implementation may begin once Accepted.
4. **Rejected.** The RFC reaches a decision not to proceed, with the reason
   recorded on the thread and in `Governance/DECISION_LOG.md`.
5. **Withdrawn.** The author pulls the RFC before a decision is reached —
   for example, because the problem changed or a better approach emerged.
6. **Superseded.** A later RFC replaces this one; the later RFC links back
   to the one it supersedes.

An RFC's implementation pull request(s) reference the RFC in their
description, and significant deviations from the Accepted design during
implementation are called out in review rather than silently diverging.

## Acceptance and Rejection Criteria

An RFC is evaluated against:

- **Problem fit.** The Motivation section links to a genuine, current
  problem, not a speculative one.
- **Design soundness.** The Detailed Design section is specific enough to
  implement, is internally consistent, and does not contradict an existing
  Accepted ADR without explicitly proposing to supersede it.
- **Considered alternatives.** At least one real alternative was evaluated
  and the tradeoff against it is explained.
- **Stated impact.** Breaking changes, migration path, security/data
  footprint, and rollout are addressed per the template — an RFC that
  glosses over impact is sent back for revision, not accepted as-is.
- **Reviewer objections resolved.** Every specific, actionable objection
  raised during review is resolved or explicitly overridden through
  `Governance/processes/OBJECTION_HANDLING.md`'s escalation path before the
  RFC can move to Accepted.

Rejection is not a judgment on the author; a rejected RFC's discussion often
informs whatever proposal follows it, and the record is kept (not deleted)
for that reason.

## Where RFCs Are Stored

Accepted, Rejected, Withdrawn, and Superseded RFCs are kept — never deleted —
under `Governance/rfcs/` (created as the first RFC is opened), numbered per
`Governance/templates/RFC_TEMPLATE.md`'s scheme, so the project's design
history stays discoverable in one place regardless of outcome.

## Review

This process is reviewed whenever the RFC template or the decision-making
processes it depends on change materially. Changes are proposed through the
normal governance process described in `Governance/README.md` and must touch
only the `Governance/` folder.
