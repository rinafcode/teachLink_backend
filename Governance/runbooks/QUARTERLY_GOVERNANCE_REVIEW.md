# Quarterly Governance Review

This process defines the agenda and inputs of the project's quarterly
review of governance: what is examined, what metrics inform it, what
decisions it is expected to produce, and how follow-ups are tracked. It
exists so governance changes are deliberate and recorded rather than
accumulated.

This document is part of the project's **Governance** area. It lives
entirely inside the `Governance/` folder and does not change application
code. The document-level review procedure is
`Governance/runbooks/GOVERNANCE_REVIEW_RUNBOOK.md`.

## Agenda And Inputs

**Agenda**

1. Review record from the previous quarter: open follow-ups and their status.
2. Document inventory sweep (executes the governance review runbook).
3. Registers: maintainers, exceptions, dependencies, subprocessors — one
   pass each, freshness and open items only.
4. Matrices: escalation, on-call, permissions — coverage gaps and stale
   assignments.
5. Decisions requiring a vote, using
   `Governance/processes/LAZY_CONSENSUS.md` unless a formal vote is called.
6. Follow-up assignment and close.

**Inputs (prepared before the review)**

- The governance review record from the runbook sweep.
- Current contents of every register, with stale entries marked.
- On-call coverage for the quarter, including accepted gaps.
- Open exceptions and their expiry dates.
- Metrics listed below, with their sources.
- Decisions deferred to this review from working sessions.

## Metrics Reviewed

| Metric | Source | Why it matters |
|---|---|---|
| Governance documents reviewed vs. total | Review record | Coverage of the quarterly sweep. |
| Documents past their review date | `Governance/` inventory | Staleness of the governance set. |
| Open exceptions / expired-but-open | Exception register | Whether exceptions are being closed. |
| Maintainer activity vs. register | Maintainer register | Whether the register reflects reality. |
| Accepted on-call gaps | On-call matrix | Whether coverage is actually holding. |
| Open findings from dependency audit | Audit record | Security debt carried forward. |
| Mean time to close governance issues | Issue tracker | Whether follow-ups are landing. |

## Decisions And Follow-Ups

- Every decision made in the review is recorded in the quarter's entry in
  `Governance/reporting/QUARTERLY_GOVERNANCE_REPORT.md` with the date, the
  decision, and the dissenting view if any.
- Each follow-up gets one owner and a due date, and becomes a linked issue;
  the review does not create obligations that live only in its notes.
- Decisions that change a policy document require their own pull request —
  the quarterly record is where a decision is logged, not where the policy
  text changes.
- The next quarter's agenda opens with the previous quarter's follow-ups;
  an item missed twice is escalated through Tier 3 of
  `Governance/matrices/ESCALATION_MATRIX.md`.
