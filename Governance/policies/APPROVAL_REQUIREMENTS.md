# Pull Request Approval Requirements Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/APPROVAL_REQUIREMENTS.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-09-28 |
| Review cadence | Every 6 months, or after any change to branch protection |
| Applies to | Every pull request opened against `rinafcode/teachLink_backend` |

This policy is the single, versioned reference for **how many approvals a pull
request needs**, **which automated checks must be green**, and **who may
override a requirement when it cannot be met**. It makes the table in
[`CONTRIBUTING.md` §4](../../CONTRIBUTING.md) explicit per change type, so that
"it depends" has a written answer.

It is governance only. It changes no application behaviour and is scoped
entirely to the `Governance/` folder.

## 1. How to read this policy

Two numbers together authorise a merge:

- **Approvals** — human reviewers who have read the change and approved it.
- **Checks** — automated jobs that must report `success`.

Both must be satisfied. An approval never substitutes for a required check, and
a green check never substitutes for an approval. The merge button is disabled
until both are met.

Throughout this document:

- **Code owner** means a maintainer responsible for the touched path, as mapped
  in [`CONTRIBUTING.md` §9](../../CONTRIBUTING.md). That section shows the
  intended `CODEOWNERS` mapping; **no `CODEOWNERS` file is committed to the
  repository yet**. Until it is, treat the team named for the module in
  `CONTRIBUTING.md` §9 as the code owner, and if no team is named, any
  maintainer other than the author satisfies the code-owner approval.
- **Maintainer** means someone holding the Maintainer GitHub role, the only role
  that can merge ([`CONTRIBUTING.md` §11](../../CONTRIBUTING.md)).
- **Governance change** means any change whose diff touches `Governance/`.
- **Sign-off** means a `Signed-off-by:` trailer, as required by
  [`DCO.md`](DCO.md).

## 2. Minimum approvals per change type

| # | Change type | Target `develop` | Target `main` | Code-owner approval required | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Documentation only (Markdown, no `src/` or config) | 1 | 2 | No | `docs/`, `README.md`, and other prose changes follow this row. |
| 2 | Governance document (`Governance/**`) | 1 | 2 | No | Also bound by [`SCOPE.md`](../SCOPE.md); at most two files per governance change. |
| 3 | Test-only change (`*.spec.ts`, `test/`) | 1 | 2 | No | Approval must come from someone who can judge test design. |
| 4 | Dependency or manifest change (`package.json`, `pnpm-lock.yaml`) | 2 | 2 | Yes (devops) | Also bound by [`domains/DEPENDENCY_APPROVAL.md`](../domains/DEPENDENCY_APPROVAL.md). |
| 5 | Database migration or schema change | 2 | 2 | Yes | Includes `src/**/migrations/**` and entity changes that require one. See [`domains/DB_MIGRATION_GOVERNANCE.md`](../domains/DB_MIGRATION_GOVERNANCE.md). |
| 6 | Configuration, environment, or secret handling | 2 | 2 | Yes (devops) | Includes `src/config/**`, `.env.example`, and CI workflows. See [`domains/SECRETS_MANAGEMENT.md`](../domains/SECRETS_MANAGEMENT.md). |
| 7 | Security-sensitive code (auth, crypto, payments, web3) | 2 | 2 | Yes | The owning team from `CODEOWNERS` must be among the approvers. |
| 8 | API contract change (route, DTO, response shape) | 2 | 2 | Yes | Also bound by [`domains/API_CHANGE_GOVERNANCE.md`](../domains/API_CHANGE_GOVERNANCE.md) and [`domains/API_VERSIONING.md`](../domains/API_VERSIONING.md). |
| 9 | Ordinary application code (`src/**`) | 1 | 2 | Yes | The default row. |
| 10 | Release / version bump | 2 | 2 | Yes | Also requires [`processes/RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md). |
| 11 | Hotfix straight to `main` | — | 2 | Yes | See §6. The change must be back-merged to `develop` afterwards. |
| 12 | Revert of a merged PR | 1 | 2 | No | The revert must cite the PR it reverses. |

When a PR spans several rows, **the strictest applicable row wins** — the
approval count is the maximum, and every code owner implicated by any row must
approve. For example, a migration that also changes a route needs the
migration row's two approvals, plus approval from both the migration and API
code owners.

An approval from the PR author never counts toward the requirement, even if the
author is a maintainer. A maintainer may approve their own PR only to satisfy the
"one maintainer has seen it" spirit; it does not count as one of the required
approvals.

## 3. Required checks

### 3.1 Always required

The following must report `success` on every pull request, regardless of change
type. They correspond to the jobs in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

| Check (workflow job) | What it enforces |
| --- | --- |
| `No build artifacts in git` | `dist/`, `*.tsbuildinfo`, and `compliance/reports/` are not tracked. |
| `validate` | Lint (`pnpm run lint:ci`), TypeScript (`pnpm run typecheck`), build (`pnpm run build`), migration hygiene (`migrations:check`), migrations apply, schema-drift check, and migration revert. |

A failing `validate` job blocks merge on **every** row of §2, including
documentation-only changes. There is no change type exempt from these two.

### 3.2 Conditionally required

| Check | When it is required | Current gate status |
| --- | --- | --- |
| `security-scan` | Every PR; blocks only once the inherited audit backlog is cleared | Advisory — `pnpm audit --audit-level=high` runs with `continue-on-error: true` during the phased rollout described in issue #529. The licence scan is always evaluated. |
| Unit tests (Jest, coverage ≥ 70 %) | Every change to `src/**` | See §3.3. |
| E2E tests (Supertest, Postgres + Redis) | Every change to `src/**` that touches a route, guard, or migration | See §3.3. |

### 3.3 Checks documented in `CONTRIBUTING.md` but not yet in CI

[`CONTRIBUTING.md` §4](../../CONTRIBUTING.md) lists unit and E2E runs and an
aggregate `CI Passed` gate. The current `ci.yml` does not define them. This
policy does not invent them: until they exist, a reviewer approving a `src/**`
change **must** either (a) confirm the author ran the relevant suite locally and
recorded the result in the PR, or (b) treat the absence as a blocking gap and
request it. When those jobs land, this section is replaced by their job names and
they become unconditionally required.

## 4. Review validity

- **Stale approvals are dismissed.** Pushing any new commit to a PR under review
  invalidates all existing approvals
  ([`CONTRIBUTING.md` §9](../../CONTRIBUTING.md)). The reviewers must re-approve
  the new state.
- **Conversations must be resolved.** Every review thread must be marked resolved
  before merge. Authors do not resolve reviewer threads; the reviewer does.
- **The branch must be current.** The head branch must contain the target
  branch's tip, or be mergeable without conflict.
- **Approvals expire with the base.** If the target branch moves and the PR is
  rebased or merged-up, approvals stand only if the diff is unchanged; if the
  rebase resolved a conflict, treat the approvals as stale and re-request.
- **Sign-off.** Every commit must carry a `Signed-off-by:` trailer
  ([`DCO.md`](DCO.md)). A missing sign-off is a blocking review comment, not an
  override.

## 5. Override rules

An override is the authorised relaxation of a requirement in §2 or §3. Overrides
are exceptional, must be recorded, and may never relax a rule marked
**non-overridable** below.

### 5.1 Who may override what

| Requirement | May be overridden by | Conditions |
| --- | --- | --- |
| One of two required approvals (target `main`) | Project lead | The second reviewer is unreachable for ≥ 5 business days, the PR is not security-sensitive, and the override is stated in a PR comment. |
| Code-owner approval | Project lead | The code owner is inactive (see [`INACTIVITY.md`](INACTIVITY.md)) or unreachable for ≥ 5 business days. |
| Documentation-only, on `main`, second approval | Project lead | The change is inside `Governance/` or `docs/` and modifies no code, config, or dependency. |
| `security-scan` audit failure | — | Advisory today under #529; becomes non-overridable when the flag is removed. |
| Revert of a clearly broken merge | Maintainer | May merge with **1** approval and without code-owner approval, provided the revert is a clean `git revert` of exactly one merge and the incident is linked. |

### 5.2 Requirements that may never be overridden

The following are non-overridable. If they cannot be met, the change does not
merge — it is reworked, split, or withdrawn:

1. **No build artifacts in git** (`no-build-artifacts`).
2. **`validate` must pass** — lint, typecheck, build, migrations apply, schema
   drift, migrations revert.
3. **No secrets in the diff** — credentials, tokens, keys, or `.env` values
   ([`domains/SECRETS_MANAGEMENT.md`](../domains/SECRETS_MANAGEMENT.md)).
4. **`CODEOWNERS` approval for a security-sensitive path** on `main` (row 7) —
   the owning team must actually approve; the requirement moves to the project
   lead only if the team is itself inactive.
5. **DCO sign-off** — every commit, no exceptions.
6. **Branch protection** — no override may be implemented by disabling a
   protection rule, adding a bypass actor, or force-pushing to `main` or
   `develop`.
7. **Direct push to `main` or `develop`** — never permitted, for anyone,
   including repository admins.

### 5.3 How to record an override

Every override must be visible in the pull request itself, before merge:

- a comment stating which requirement is being relaxed;
- the reason it could not be met;
- the name of the person exercising the override;
- for approval overrides, the justification that the unavailable reviewer was
  genuinely unreachable and the waiting period was observed.

An override that is not recorded in the PR did not happen. If the merge already
occurred, the maintainer must post the record on the merged PR and note it in
[`DECISION_LOG.md`](../DECISION_LOG.md).

### 5.4 Emergency overrides

During a declared incident, the on-call maintainer may merge a fix with **1**
approval and without code-owner approval. The constraints are:

- only the non-overridable list in §5.2 still applies in full;
- the change is the minimum needed to stop the harm;
- the record required by §5.3 is posted within **24 hours**;
- a follow-up review by the owning code owner is completed within **5 business
  days**, and any resulting change lands as its own PR.

Emergency override authority does not extend to dependency additions, secret
rotation policy, or branch-protection changes.

## 6. Hotfixes to `main`

A hotfix may target `main` directly, bypassing `develop`, only when:

- the change fixes a production outage, a security vulnerability, or data loss;
- it is scoped to the smallest possible diff;
- it meets row 11 of §2 — **2 approvals** including a code owner — or the §5.4
  emergency override applies;
- it carries a DCO sign-off and passes `validate`.

After merge, the hotfix is back-merged to `develop` immediately
([`CONTRIBUTING.md` §11](../../CONTRIBUTING.md)). A back-merge is not optional,
and opening the follow-up PR is the merging maintainer's responsibility.

## 7. Relationship to other documents

| Document | Relationship |
| --- | --- |
| [`CONTRIBUTING.md`](../../CONTRIBUTING.md) §4, §9, §11 | States branch protection and the review policy. This document refines §4 into a per-change-type table. Where they differ, the stricter requirement applies; `CONTRIBUTING.md` remains authoritative for branch protection settings. |
| [`CONTRIBUTING.md` §9](../../CONTRIBUTING.md) | Names the code owners this policy requires; the `CODEOWNERS` mapping it shows is not yet committed. |
| [`policies/REVIEW_SLA.md`](REVIEW_SLA.md) | Response and completion timescales for the reviews this policy requires. |
| [`policies/DCO.md`](DCO.md) | The sign-off requirement referenced throughout. |
| [`policies/STALE_PRS.md`](STALE_PRS.md) | What happens to a PR that never reaches the required approvals. |
| [`domains/DB_MIGRATION_GOVERNANCE.md`](../domains/DB_MIGRATION_GOVERNANCE.md) | Extra requirements for migration changes. |
| [`domains/DEPENDENCY_APPROVAL.md`](../domains/DEPENDENCY_APPROVAL.md) | Extra requirements for dependency changes. |
| [`domains/SECRETS_MANAGEMENT.md`](../domains/SECRETS_MANAGEMENT.md) | The non-overridable no-secrets rule. |
| [`processes/HOTFIX.md`](../processes/HOTFIX.md) | The operational hotfix procedure that §6 summarises. |
| [`DECISION_LOG.md`](../DECISION_LOG.md) | Where overrides and emergency merges are recorded. |

## 8. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-09-28 | 1.0.0 | **Initial release.** Minimum approvals per change type (§2), required checks and their current gate status (§3), review validity (§4), override rules including the non-overridable list (§5), and hotfix requirements (§6). |
