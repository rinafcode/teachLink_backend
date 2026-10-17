# Code Freeze Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/CODE_FREEZE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team, with the release manager |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | All contributions to the project's code, configuration, dependencies, and database schema during a declared freeze |
| Related | [`RELEASE_BRANCHING.md`](RELEASE_BRANCHING.md) · [`processes/RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) · [`roles/RELEASE_MANAGER.md`](../roles/RELEASE_MANAGER.md) · [`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md) · [`APPROVAL_REQUIREMENTS.md`](APPROVAL_REQUIREMENTS.md) · [`MERGE_STRATEGY.md`](MERGE_STRATEGY.md) · [`BACKPORT.md`](BACKPORT.md) · [`EMBARGO.md`](EMBARGO.md) · [`REVIEW_SLA.md`](REVIEW_SLA.md) · [`COMMUNICATION_NORMS.md`](COMMUNICATION_NORMS.md) |

A code freeze is a time-boxed period during which changes to the repository are
restricted so that a release candidate, a maintenance window, or a security
response stays stable and verifiable. This policy defines **when** a freeze
applies, **what** is still allowed during one, and **how** an exception is
requested and approved. It is the versioned reference for code freezes within
the `Governance/` folder; changes to it are made by pull request and reviewed
by a maintainer.

## 1. When a freeze applies

A freeze is always explicit: it exists only once it has been declared and
announced under §1.2. Silence is not a freeze.

### 1.1 Freeze triggers

| Trigger | Declared by | Default window | Reference |
| --- | --- | --- | --- |
| **Release stabilization** — from cutting `release/x.y.z` until the release is tagged and merged to `main` | Release manager | Duration of release stabilization | [`RELEASE_BRANCHING.md`](RELEASE_BRANCHING.md) |
| **Release sign-off** — from the start of the sign-off gates until the release decision is recorded | Release manager | Until all §2 sign-offs in the release record complete | [`processes/RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) |
| **Security embargo** — branches carrying or targeting a vulnerable version line while a fix is under embargo | Maintainer (security response) | Until the embargo lifts per the embargo table | [`EMBARGO.md`](EMBARGO.md) |
| **Incident or degraded service** — from the declaration of a major incident until the all-clear | Incident commander / lead maintainer | Until the incident is resolved | [`processes/ESCALATION_PATH.md`](../processes/ESCALATION_PATH.md) |
| **Error-budget exhaustion** — a service's budget is exhausted and non-remediation deployments are frozen | Service owner + maintainer group | Until the corrective review completes | [`domains/SLA_SLO.md`](../domains/SLA_SLO.md) · [`domains/MIGRATION_ROLLBACK.md`](../domains/MIGRATION_ROLLBACK.md) |
| **Scheduled maintenance** — an operator-initiated window (database migration, dependency upgrade, infrastructure change) | Maintainer | Announced window, stated start and end | [`domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md) |

### 1.2 Declaration and announcement

1. **Who may declare.** The release manager, any maintainer, or the incident
   commander (during an incident) may declare a freeze. Contributors cannot
   declare a freeze for others, but may request one.
2. **What a declaration must state.** The scope (repository-wide or named
   paths/branches), the reason, the trigger from §1.1, the start time, the
   expected end time (or the event that ends it), the exception approver, and
   the freeze owner to whom exception requests are sent.
3. **Where it is announced.** The declaration is posted as a pinned GitHub
   issue in the repository, repeated in the pull request under freeze at the
   time of declaration, and mirrored to the community channels listed in
   [`COMMUNICATION_NORMS.md`](COMMUNICATION_NORMS.md).
4. **Effective time.** A freeze takes effect when the declaration is published,
   and applies to pull requests that are open at that time as well as new ones.
5. **Ending a freeze.** The freeze owner announces the end of the freeze in the
   same channels, and the release is tagged (or the incident all-clear given)
   before normal merging resumes. If a freeze must be extended, the extension
   is announced as an amendment to the original declaration with a new expected
   end time.

## 2. What is allowed during a freeze

### 2.1 Permitted changes

During a declared freeze the following may be merged, provided they satisfy
every applicable requirement in §2.2:

| Permitted | Examples |
| --- | --- |
| **Regression and defect fixes** | Fixes for behaviour that regressed in the release candidate, crashes, data-correctness bugs, and failed CI introduced within the release cycle |
| **Security fixes** | Patches, config changes, or compensating controls delivered under [`VULN_SLA.md`](VULN_SLA.md) and the embargo rules in [`EMBARGO.md`](EMBARGO.md) |
| **Release-blocking fixes** | Anything the release manager or sign-off checklist identifies as a blocker for shipping the current release |
| **Documentation and comments** | README, `docs/`, governance, runbooks, changelog entries, and inline comments — changes with no runtime effect |
| **Change-record updates** | Release notes, [`CHANGELOG_POLICY.md`](CHANGELOG_POLICY.md) entries, the release record, and decision-log entries |
| **Reverts** | Reverting an already-merged change that destabilises the candidate |
| **CI and tooling hotfixes** | Fixes to CI, lint, or build configuration required to keep the required checks (§3.1) green for the candidate |

### 2.2 Prohibited during a freeze

Unless approved as an exception under §3:

- New features, product behaviour changes, and API additions.
- Refactoring, renaming, "while I was here" cleanups, and formatting-only sweeps
  of code not being fixed.
- Dependency upgrades, lockfile churn, and toolchain bumps — security fixes are
  the one exception and follow §2.1.
- Database schema or migrations not required to unblock the release or an
  incident ([`domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md) gates
  still apply).
- Branch/permission/CI structural changes, including edits to protection rules
  ([`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md)).
- Deleting or force-pushing branches — prohibited at all times, and doubly so
  during a freeze.
- Merging by bypassing required checks, required approvals, or the CODEOWNERS
  review ([`APPROVAL_REQUIREMENTS.md`](APPROVAL_REQUIREMENTS.md) §5).

### 2.3 Requirements for every change that does land

1. The PR states in its description that it is freeze-scope and names the
   trigger (§1.1) and justification it relies on.
2. All required checks pass: `validate`, "No build artifacts", DCO sign-off,
   and the approvals required by
   [`APPROVAL_REQUIREMENTS.md`](APPROVAL_REQUIREMENTS.md) §2 for the change
   type — a freeze never lowers the approval bar.
3. The change is the smallest one that satisfies its purpose; prefer a focused
   fix PR over a broad one, so review stays fast and rollback stays simple.
4. The merge uses the strategy in [`MERGE_STRATEGY.md`](MERGE_STRATEGY.md);
   merges during a freeze are done by the freeze owner or release manager.

**Review SLA.** While a freeze is active, the review SLA rows for pull requests
targeting `main` are suspended as stated in
[`COMMUNICATION_NORMS.md`](COMMUNICATION_NORMS.md) §4.3; freeze-scope PRs are
instead triaged promptly by the freeze owner, who acknowledges them within one
business day and either merges, requests changes, or reclassifies them as an
exception request under §3.

## 3. Exception process

An exception is pre-approval to land a change that §2.2 would otherwise
prohibit.

### 3.1 Who may approve

| Request | Approver(s) |
| --- | --- |
| Fix required to unblock the current release | Release manager ([`roles/RELEASE_MANAGER.md`](../roles/RELEASE_MANAGER.md); final release authority stays with the lead maintainer) |
| Operational or feature change during an incident freeze | Incident commander **and** a maintainer |
| Routine feature or cleanup work | Two maintainers, including the freeze owner |
| Security fix inside an active embargo | Per [`EMBARGO.md`](EMBARGO.md) — no separate freeze exception needed |
| Repository-wide or indefinite freeze | Lead maintainer |

No one may approve their own exception where an independent approver is
available; in an emergency where it is not, the self-approved exception is
recorded and re-reviewed as soon as the emergency passes.

### 3.2 How to request one

Open an issue (or reply on the freeze declaration issue) containing:

1. **Link** to the pull request, or a precise description of the change.
2. **Trigger and scope** of the freeze it falls under (§1.1, §1.2).
3. **Category** from §2.2 and why the work cannot wait until the freeze ends —
   cost of delay, users or systems affected, and the risk of *not* landing it
   now.
4. **Risk assessment** — blast radius, rollback plan, and how it will be
   verified (tests, staging evidence).
5. **Requested approvers** per §3.1.

### 3.3 How requests are decided

- The approvers respond within **one business day** for non-urgent requests and
  **four hours** for incident-driven ones.
- Approval is recorded as a comment on the request naming the approver, the
  rationale, and any limits (single PR, specific paths, expiry).
- A denial must state the reason and what would make the request approvable
  after the freeze.
- Approved exceptions are **narrow**: they cover the named pull request only,
  never a category of future work.

### 3.4 Recording and expiry

- Every granted exception is logged in
  [`DECISION_LOG.md`](../DECISION_LOG.md) within **24 hours** using its entry
  format, mirroring the override-recording rule in
  [`APPROVAL_REQUIREMENTS.md`](APPROVAL_REQUIREMENTS.md) §5.3.
- An exception expires when the freeze ends or at the expiry stated in the
  approval, whichever is earlier. Landed changes are **not** rolled back when
  an exception expires.
- Escalation disputes about a freeze decision follow
  [`processes/ESCALATION_PATH.md`](../processes/ESCALATION_PATH.md) and are
  decided by the lead maintainer.

## 4. Enforcement

1. **Branch protection is the enforcement mechanism.** Direct pushes and force
   pushes to protected branches are already prohibited
   ([`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md)); required checks and
   approvals continue to run normally during a freeze.
2. **Label.** Freeze-scope pull requests are labelled `freeze: exception`
   once approved under §3, based on the taxonomy in
   [`LABEL_TAXONOMY.md`](../LABEL_TAXONOMY.md), so reviewers and the freeze
   owner can see at a glance what is in scope.
3. **Non-compliant merges.** A merge that violates this policy without a
   granted exception is reverted by the freeze owner, or handled as an override
   violation under [`APPROVAL_REQUIREMENTS.md`](APPROVAL_REQUIREMENTS.md) §5,
   and noted in the decision log.
4. **Backports.** Fixes made during a release freeze to `main` that must also
   reach the release branch follow [`BACKPORT.md`](BACKPORT.md), which remains
   the authority for backport eligibility.

## 5. Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| Release manager | Declares and ends release freezes, owns the release window, approves release-blocking exceptions |
| Maintainers | Review freeze-scope PRs promptly, co-approve exceptions, enforce §2 |
| Incident commander | Declares incident freezes, approves operational exceptions during the incident |
| Contributors | Check for an active freeze before opening freeze-affected PRs, follow §3 to request exceptions |
| Lead maintainer | Approves repository-wide freezes, settles escalations |

## 6. Regression tests where applicable

This policy is a governance-only documentation change: it introduces no
executable code or runtime behaviour, so no new automated test is applicable
or required for it. Compliance is verified by review of pull requests during a
freeze rather than by a test suite.

For any future change that implements this policy in code or automation (for
example CI rules that block freeze-prohibited paths), regression tests must be
added alongside that implementation verifying that:

- a declared freeze blocks a prohibited change and permits a permitted one
  (§2.1/§2.2 classification);
- an approved exception (§3) allows the named change through, and an expired
  or absent exception does not;
- required checks and approvals are never skipped because of a freeze (§2.3,
  §4.1).

In the meantime the existing gates remain authoritative: `validate`, "No build
artifacts", DCO sign-off, migrations checks, and the approval requirements all
continue to run unchanged during a freeze.

## 7. Documentation of change

This document was added to close the governance gap recorded in issue #1840:
the `Governance/` folder had no versioned reference for code freezes, leaving
contributors and maintainers without a single place to learn when freezes
apply, what may still land, and how exceptions are granted. It is scoped to the
`Governance/` folder and modifies no application code, configuration, schema,
or dependency. Future changes to this policy are recorded in the change log
below and in `Governance/CHANGELOG.md`.

### Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release: freeze triggers and declaration (§1), permitted and prohibited changes (§2), exception process (§3), enforcement (§4), roles (§5), regression-test guidance (§6), change documentation (§7). |