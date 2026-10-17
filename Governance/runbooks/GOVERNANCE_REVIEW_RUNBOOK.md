# Governance Review Runbook

This runbook describes when the project's governance documents are reviewed,
the exact steps a reviewer follows, and how the outcome is recorded. It
exists so the governance set is maintained on a schedule rather than when
someone happens to notice something is stale.

This document is part of the project's **Governance** area. It lives
entirely inside the `Governance/` folder and does not change application
code. The calendar for this runbook is set in
`Governance/runbooks/QUARTERLY_GOVERNANCE_REVIEW.md`.

## When Governance Is Reviewed

- **Quarterly**, as part of the quarterly governance review — full sweep of
  every document in `Governance/`.
- **Ad hoc**, when a policy it covers is changed, an incident shows the
  document is wrong, or an exception in
  `Governance/registers/EXCEPTION_REGISTER.md` has been open for more than
  one quarter.
- **Before a release that changes a documented process.**

## Review Steps

1. **Prepare the inventory.** List every file under `Governance/` grouped
   by subfolder (`policies`, `processes`, `templates`, `registers`,
   `matrices`, `runbooks`, `reporting`, `roles`, `domains`, `community`).
2. **Check references.** For each file, verify that every path and document
   it links to still exists; record every broken reference.
3. **Check currency.** Compare each document's claims against the current
   repository and processes: do the roles, cadences, and commands it
   describes still exist? Is the *Last reviewed* date inside one quarter?
4. **Check coverage.** Identify governance areas with no owning document,
   and documents whose subject has been retired.
5. **Record findings.** Write one entry per finding (document, problem,
   proposed action) in the review record created in step 7.
6. **Act.** Fix trivial issues (broken links, stale dates) directly in the
   review pull request. Anything structural becomes a normal issue linked
   to the record — the review PR is not where structural changes are
   debated.
7. **Record the outcome.** Create the review record and update review
   dates as described below.

## How Changes Are Recorded

- The review itself is recorded as a dated entry in
  `Governance/reporting/QUARTERLY_GOVERNANCE_REPORT.md`, listing which
  documents were reviewed, the findings, and links to the issues or pull
  requests they produced.
- Every document that passed review gets its **Last reviewed** date updated
  in the review pull request; a document with no visible date field is
  considered stale regardless of what its content claims.
- Amendments made outside a review follow the owning process for that
  document (for example, nominations for role changes, exceptions for
  policy deviations) — the review never becomes a back channel for
  changes that require their own approval.
- The review pull request is titled `docs(governance): review <quarter>`,
  references the quarterly review record, and is approved by at least one
  maintainer who did not write the findings.
