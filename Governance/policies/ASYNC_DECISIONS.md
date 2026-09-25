# Asynchronous Decision Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-25
- **Review cadence:** Every 6 months, or after any change to the processes it references

This policy defines when a decision in the TeachLink Backend project may be
taken **asynchronously** — decided from a written proposal and written replies
in an issue, pull request, or RFC thread, without requiring participants to be
online at the same time. It states the minimum response window such a proposal
must stay open, and what must be recorded before the decision is final.

It exists because most decisions do not need a live meeting or a formal vote,
but they do need a fair chance to be objected to and a durable record of what
was decided. This policy is part of the project's **Decision-making** area. It
lives entirely inside the `Governance/` folder and does not change application
code.

## 1. Scope

This policy applies to any decision that is **not** already routed by another
governance document to:

- a formal vote (`Governance/processes/FORMAL_VOTING.md`), or
- a live, synchronous discussion (a working-group meeting or maintainer call), or
- an emergency path (see §2.5).

A decision that another governance document routes to a formal vote is never
decided asynchronously, even if nobody objects — async discussion may inform the
vote, but it does not replace it.

## 2. When Asynchronous Decisions Are Allowed

An asynchronous decision is allowed only when **all** of the following hold:

1. **Routed here.** No governance document requires a formal vote for the
   decision. In particular, nothing listed in
   `Governance/policies/SUPERMAJORITY.md` is decided asynchronously.
2. **Bounded and reversible.** The effect is contained within the project's
   normal operating envelope and a later decision can reverse it without
   unacceptable cost. Irreversible or hard-to-reverse changes — deleting a
   governance record, or a breaking public API change with no migration path —
   go to a formal vote instead.
3. **Stated in writing.** The proposal says what is being decided, why, what it
   affects, and which date the response window opens. A proposal that does not
   tell a reader what they are being asked to agree to is not yet open.
4. **Owned.** At least one maintainer accepts the thread as its owner: the
   person who watches the window, resolves or escalates objections, and records
   the outcome (§5). Asynchronous does not mean unattended.
5. **Not an emergency.** Urgent, time-critical decisions follow the emergency
   path defined for their area — for example the emergency revocation in
   `Governance/policies/REVOCATION.md` or the continuity provisions in
   `Governance/domains/DR_GOVERNANCE.md` — and are recorded afterwards.

Decisions that typically qualify include a straightforward governance change
under `Governance/`, a routine role nomination already seconded under
`Governance/processes/NOMINATION.md`, and ordinary project decisions a
maintainer proposes publicly.

Decisions that **never** qualify as asynchronous on their own include charter
amendment, removal of a maintainer's privileges where revocation calls for a
vote, and changes to the formal-voting or quorum rules. These are discussed
async if useful, then decided by the formal vote their own documents require.

## 3. Minimum Response Window

A proposal must stay open for at least the window below before it can be
decided. The window is a **minimum, not a deadline**: its owner may extend it,
and a decision taken before the window has elapsed is not valid.

| Proposal | Minimum response window |
| --- | --- |
| Straightforward governance change — a new document, or a small clarification to an existing one | **72 hours** |
| Substantive change to an existing policy or process — thresholds, eligibility, or process steps | **7 days** |
| Role or access change not already routed to a formal vote | **7 days** |
| Proposal substantially revised while open | restarts from the revision (§4) |
| Emergency change (see §2.5) | no window; recorded retrospectively with the reason it could not wait |

These windows match those in `Governance/processes/LAZY_CONSENSUS.md`, so the
two documents cannot drift: an ordinary proposal has one waiting period, not two
different ones.

## 4. How The Window Is Measured

- The window is measured from the timestamp of the proposal's **opening
  comment** in the thread — not from when review starts, and not from when a
  maintainer first notices it.
- A proposal that is **substantially revised** while open resets its own window
  from the revision, so the version actually decided had its full window to be
  objected to. Typo fixes and formatting do not reset it.
- The window runs continuously; weekends and public holidays do not extend it.
  A proposal opened immediately before a planned absence should agree a longer
  window in the thread rather than assume a shorter one.
- An unresolved objection pauses the window. The proposal cannot be adopted by
  silence while an objection stands
  (`Governance/processes/OBJECTION_HANDLING.md`).

## 5. Recording Requirement

**A decision is not final until it is recorded.** Two records are required:

1. **In the thread.** The owner posts a closing comment stating the outcome
   (adopted, withdrawn, or escalated), the window actually observed, and who
   owns the record. "Adopted by silence" is valid only when the window in §3
   elapsed with no unresolved objection.
2. **In the decision log.** The decision is appended to
   `Governance/DECISION_LOG.md` with a link to the thread. The log is
   append-only: a decision later reversed gets a **new** entry referencing the
   original, never an edit.

An illustrative log entry:

```markdown
| Date | Decision | Type | Reference | Maintained by |
| --- | --- | --- | --- | --- |
| 2026-09-25 | Adopt the asynchronous decision policy | policy | #1590 | @example-maintainer |
```

Rules that make the record trustworthy:

- The log entry's **Date** is when the decision was finalised — when the window
  closed — not when discussion started or when the entry was written.
- The entry is added by a maintainer, but not necessarily the proposer.
- A decision missing a log entry may be added retroactively, dated to when it
  was actually made and marked as added retroactively
  (`Governance/DECISION_LOG.md`).
- A decision that is not recorded may be challenged as undecided by any
  maintainer, and its outcome cannot be enforced until it is logged.

## 6. Relationship To Other Documents

- `Governance/processes/LAZY_CONSENSUS.md` — the mechanism by which an async
  proposal is adopted once no unresolved objection remains. This policy supplies
  the permission and the window; that process supplies the assent rule.
- `Governance/processes/FORMAL_VOTING.md` and `Governance/policies/QUORUM.md` —
  the route for everything this policy excludes, with its own eligibility and
  quorum rules.
- `Governance/processes/OBJECTION_HANDLING.md` — how an objection pauses a
  window and how it is escalated.
- `Governance/DECISION_LOG.md` — the log the recording requirement in §5 writes
  to.

Where this policy and another governance document conflict, the more specific
document prevails for its subject matter, and the conflict is recorded as a
governance issue.

## 7. Change Log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-25 | Initial asynchronous decision policy (permission, minimum response window, recording requirement). |
