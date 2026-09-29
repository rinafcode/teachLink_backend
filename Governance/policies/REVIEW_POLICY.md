# Code Review Policy

**Policy version:** 1.0.0
**Effective date:** 2026-09-28
**Owner:** Maintainer Team

## Purpose and scope

This policy defines what must be reviewed before a change is merged, who may
review it, and what a reviewer is expected to check. It is the governance
reference for review requirements; it does not replace `CONTRIBUTING.md`, which
remains authoritative for contribution mechanics. Where the two overlap and
disagree, `CONTRIBUTING.md` wins and this document is amended to match.

It applies to every pull request opened against `rinafcode/teachLink_backend`,
on any target branch, including pull requests that touch only documentation,
CI configuration, or the `Governance/` folder itself.

## Review requirements before merge

A pull request may be merged only when all of the following hold:

| Requirement | Rule |
|---|---|
| Approvals | `develop` targets require 1 approval; `main` targets require 2, at least one of which is from a code owner of the affected module |
| Independent approvals | The two approvals on a `main` target must come from two different reviewers; an author approval never counts (see [Reviewer independence](#reviewer-independence)) |
| Code-owner review | Where a `CODEOWNERS` file is present, GitHub requests review from the owner of each touched path and that review must be resolved before merge |
| CI | The `CI Passed` gate must be green — lint, format check, type check, build, unit tests, and E2E (`CONTRIBUTING.md` §4) |
| Sign-off | Every commit carries a `Signed-off-by` trailer (`Governance/policies/CONTRIBUTOR_SIGNOFF.md`) |
| Unresolved threads | All review conversations are resolved, and reviewers resolve their own threads |
| Fresh approval | New commits pushed after an approval invalidate it; the reviewer must re-approve once they have read the new commits |

Approvals are granted by a maintainer with merge rights. A `Comment`-only
review, a reaction, or an acknowledgement of receipt is not an approval. A
maintainer may merge only when they could have reviewed the change themselves;
if they are not the right reviewer, they must request a review from someone who
is instead of approving to unblock the queue.

Timeliness of review is governed separately by
[`REVIEW_SLA.md`](REVIEW_SLA.md). This policy defines what a review must cover,
not how quickly it happens.

## Review scope

### What every reviewer must check

- **Intent** — the change does what the linked issue asked for, and nothing
  beyond it.
- **Correctness** — the logic holds on the failure paths, not only the happy
  path.
- **Security** — no secrets or credentials in code or fixtures, input
  validation on every new entry point, auth guards applied where required.
- **Tests** — new behaviour is covered, and tests fail if the behaviour is
  removed.
- **Contracts** — no silent breaking change to an existing endpoint, DTO, event
  payload, or GraphQL schema.
- **Consistency** — shared logger, guards, filters, and NestJS dependency
  injection are used instead of ad-hoc equivalents.
- **Performance** — no N+1 queries, no unbounded loops over database
  collections.
- **Scope** — the diff is limited to what the change needs.

### What is out of scope for a line-by-line review

- Formatting and import order, which Prettier owns. Reviewers should not spend
  review comments on it.
- Rewriting an author's approach when a working solution exists. Style
  preferences are non-blocking unless the project has already adopted a
  convention.
- Discussion of scope beyond the linked issue. New features are raised as
  separate issues, per `Governance/processes/TRIAGE.md`.

### Review of governance documents

A pull request that changes only files under `Governance/` is reviewed for
accuracy and internal consistency — that its cross-references resolve, that it
does not contradict an existing document, and that it states the version and
effective date. It is not required to add tests, and it follows the same
approval and independence rules as code.

## Reviewer independence

Review must be an independent check. A review that is merely the author
re-reading their own work provides no assurance, so the following rules apply:

1. **No self-approval.** No one may approve a pull request they authored, and an
   author's approval or comment is discarded when counting toward the required
   approvals. This holds even for maintainers and for single-commit changes.
2. **Distinct reviewers.** The two approvals required for a `main` target must
   come from two different accounts. One person cannot satisfy the requirement
   twice, through two review rounds or two commits.
3. **Author cannot be the second reviewer.** A PR authored by a maintainer still
   needs a second, different maintainer to approve it.
4. **Declared conflicts.** A reviewer who has a direct interest in the outcome —
   authorship, a financial stake in a dependency or vendor being adopted, or a
   personal relationship with the author — must say so in the PR thread and
   step aside. A maintainer reassigns the review rather than relying on the
   author's self-report.
5. **Single-reviewer exception.** Where the project has only one available
   reviewer, the merge is permitted but the author must state in the PR thread
   that a second independent reviewer was unavailable. The exception is
   recorded, not silent, and does not become a default.
6. **Good faith.** Approval means the reviewer read the diff and believes the
   change is correct and safe to ship. Bulk approvals and approvals added
   without reading the change are treated as a breach of this policy and are
   handled under `Governance/policies/REVOCATION.md`.

## Regression tests where applicable

Code changes must ship with tests for the behaviour they add or alter, and a
reviewer treats a missing regression test on a behavioural change as a blocking
comment. Documentation-only and governance-only changes add no tests, because
they add no runtime behaviour; the CI pipeline is the check for those, and
existing lint, type check, build, and test suites must still pass.

## Related documents

- [`Governance/README.md`](../README.md) — the governance structure and how
  governance changes are proposed.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) §9 — the authoritative PR review
  policy, including the approval counts and stale-approval rule restated here.
- [`Governance/policies/REVIEW_SLA.md`](REVIEW_SLA.md) — review response
  targets and escalation.
- [`Governance/policies/STALE_PRS.md`](STALE_PRS.md) — closing abandoned pull
  requests.
- [`Governance/policies/CONTRIBUTOR_SIGNOFF.md`](CONTRIBUTOR_SIGNOFF.md) — the
  DCO sign-off gate.
- [`Governance/policies/COMMUNICATION_NORMS.md`](COMMUNICATION_NORMS.md) —
  tone and etiquette for review comments.
- [`Governance/processes/ESCALATION_PATH.md`](../processes/ESCALATION_PATH.md) —
  what to do when a review is blocked or a reviewer is unavailable.

## Version history

- 1.0.0 (2026-09-28): Establish the code review policy — requirements before
  merge, review scope, and the reviewer independence rule.
