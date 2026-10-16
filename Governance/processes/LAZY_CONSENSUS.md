# Lazy-Consensus Decision Process

This document defines when lazy consensus applies in the TeachLink Backend
project, the minimum waiting period before a lazy-consensus proposal is
considered decided, and how an objection blocks it. Lazy consensus is the
default, low-overhead way most day-to-day decisions are made — the
alternative, a formal vote, is reserved for decisions that need an explicit,
binding outcome.

This process is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## When Lazy Consensus Applies

Lazy consensus applies to most proposals that are not explicitly required to
go through `Governance/processes/FORMAL_VOTING.md`:

- Ordinary governance changes (a new or amended policy, process, or
  template) proposed as a pull request against `Governance/`.
- Routine role nominations already seconded under
  `Governance/processes/NOMINATION.md` (lazy consensus is the mechanism that
  runs during that process's decision window).
- Any other project decision a maintainer proposes publicly and no
  governance document routes to a formal vote instead.

Lazy consensus does **not** apply to anything `Governance/processes/FORMAL_VOTING.md`
names as requiring a formal vote — those decisions always go through voting,
even if no one objects.

## How It Works

1. **Propose.** The proposal is posted publicly — as a pull request
   description, or an issue comment — stating clearly what is being decided.
2. **Wait.** The proposal sits open for at least the minimum waiting period
   below, during which anyone with standing to comment on it may object.
3. **Decide.** If the waiting period elapses with no unresolved objection,
   the proposal is considered adopted without needing anyone to explicitly
   say "yes" — silence, after a fair chance to object, is consent.
4. **Record.** The adopting maintainer merges the pull request (or otherwise
   enacts the decision) and logs it in `Governance/DECISION_LOG.md` with type
   `lazy-consensus`.

## Minimum Waiting Period

- **72 hours** for a straightforward governance change (a new document, a
  small clarification to an existing one) — matching the scope limits in
  `Governance/README.md` ("Contributing to governance").
- **7 days** for anything that changes an existing policy's substance
  (thresholds, eligibility, or process steps), or for a role nomination's
  decision window under `Governance/processes/NOMINATION.md`.
- The waiting period starts when the proposal is posted, not when review
  begins. A proposal that is substantially revised during the window resets
  its own waiting period from the revision, so the version actually adopted
  had its full window to be objected to.

## How An Objection Blocks It

- A single specific, actionable objection (per
  `Governance/processes/OBJECTION_HANDLING.md`) pauses lazy consensus for
  that proposal — this is what distinguishes lazy consensus from a plain
  timeout. The proposal cannot be adopted by silence while an unresolved
  objection stands.
- The objection is handled per `Governance/processes/OBJECTION_HANDLING.md`:
  acknowledged, discussed, and either resolved (the proposal is revised or
  the objector is satisfied) or escalated.
- If the objection cannot be resolved through discussion or mediation, it
  escalates to a formal vote (`Governance/processes/FORMAL_VOTING.md`) per
  the objection-handling process's own escalation path — lazy consensus does
  not have its own separate escalation mechanism.
- Withdrawing an objection (the objector is satisfied, or no longer wishes to
  block) immediately allows the waiting period to resume from where it left
  off, not restart from zero, unless the proposal itself was revised in the
  meantime.

## Review

This process is reviewed whenever the objection-handling or formal-voting
processes it depends on change materially. Changes are proposed through the
normal governance process described in `Governance/README.md` and must touch
only the `Governance/` folder.
