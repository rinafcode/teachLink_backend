# ADR Process

This document defines when an Architecture Decision Record (ADR) is written
in the TeachLink Backend project, the lifecycle it moves through, and where
ADRs are stored. An ADR records a technical decision **that has already been
made** — the decision itself, the reasoning, and the alternatives considered
— as distinct from an RFC (`Governance/processes/RFC_PROCESS.md`), which is
used to propose and review a decision *before* it is made.

This process is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## When An ADR Is Written

An ADR is written for a decision that is architecturally significant and
worth explaining to someone reading the codebase months or years later:

- The outcome of an Accepted RFC (`Governance/processes/RFC_PROCESS.md`) —
  the ADR is the durable, permanent record; the RFC thread is the discussion
  that led to it.
- A significant technical decision made without a full RFC because it was
  small enough not to require one, but non-obvious enough that a future
  contributor would otherwise reasonably ask "why was it built this way?"
- A decision to reverse or materially change a previous ADR — recorded as a
  new ADR that supersedes the old one, never as an edit to the original.

Routine implementation choices that follow already-established patterns do
not need an ADR — the pattern's own original ADR already covers the
reasoning.

## ADR Lifecycle

1. **Proposed.** The ADR is drafted and opened as a pull request against
   `Governance/adr/`. For an ADR following an Accepted RFC, this is close to
   a formality — the decision was already made during RFC review — but the
   ADR itself still goes through review to confirm it accurately reflects
   what was decided.
2. **Accepted.** The pull request is merged. From this point the ADR is
   immutable content: its status may change (see below) but its text is not
   rewritten to reflect hindsight — a changed mind gets a new ADR.
3. **Superseded.** A later ADR replaces this one. The superseded ADR's
   status is updated to `Superseded by ADR-NNNN` (a one-line status edit is
   the one exception to immutability — the original reasoning stays
   intact), and the new ADR links back to the one it replaces.
4. **Deprecated.** The decision no longer applies (the feature it concerned
   was removed) but was not replaced by a different decision. Marked
   `Deprecated` with a one-line reason, same exception as above.

An ADR is never deleted; even a superseded or deprecated one remains part of
the project's history in `Governance/adr/`.

## ADR Contents

Each ADR is a short, focused document:

- **Title** — a short phrase naming the decision (not the problem).
- **Status** — Proposed | Accepted | Superseded | Deprecated.
- **Context** — the situation and constraints that led to needing a decision.
- **Decision** — what was decided, stated plainly.
- **Alternatives considered** — what else was on the table and why it lost.
- **Consequences** — what becomes easier or harder as a result, including
  tradeoffs accepted knowingly.

An ADR is deliberately short — a page or two. Detailed design belongs in the
RFC that preceded it (where one exists) or in the code and its own
documentation, not duplicated into the ADR.

## Where ADRs Are Stored

ADRs are stored under `Governance/adr/`, one file per decision, numbered
sequentially (`ADR-0001-<short-title>.md`, and so on) so the numbering
itself gives a rough chronology. The `Governance/adr/` directory is created
when the first ADR is written; an index of accepted ADRs is maintained at
`Governance/adr/README.md` once more than a handful exist.

## Review

This process is reviewed whenever the RFC process it complements changes
materially. Changes are proposed through the normal governance process
described in `Governance/README.md` and must touch only the `Governance/`
folder.
