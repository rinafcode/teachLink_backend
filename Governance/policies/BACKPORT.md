# Backport Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-30
- **Review cadence:** Every 6 months, or after any release-process change that
  affects release or hotfix branches

This policy defines how TeachLink Backend moves fixes from one release line to
another: which branches receive backports, what makes a change eligible to be
backported, and how a backport is proposed, approved, merged, and verified. It
exists so that consumers on older release lines get critical fixes without being
forced to take new features, and so that backporting stays predictable rather
than an ad-hoc negotiation during an incident.

"Backport" means taking a change that has already merged into the current
development line (or a hotfix on `main`) and applying an equivalent change to an
older release branch so it can ship in that line's next patch release.

This document is governance only. It does not change application behaviour and
is scoped entirely to the `Governance/` folder.

## 1. Scope

This policy covers every change backported to any maintained release branch of
this repository, including:

- Bug fixes that restore correct behaviour (wrong value, wrong status code,
  wrong error body).
- Security fixes, following the coordination and timing rules of the project's
  security disclosure process, which take precedence over the scheduling here.
- Performance and reliability fixes for regressions or defects.
- Documentation corrections where the documentation is materially wrong on the
  older line (for example, an incorrect upgrade or migration instruction).

Out of scope: new features, refactors, dependency minor or major upgrades, test
or tooling churn that fixes nothing observable, and anything that would change
the documented contract of the older line. Feature work reaches consumers
through the normal release process, not through backports.

## 2. Branches that receive backports

| Branch | Purpose | Receives backports |
| --- | --- | --- |
| `develop` | Integration branch; all feature PRs target here | Not applicable — it is the *source* line for forward work, not a backport target |
| `main` | Production-ready code | Yes — hotfixes per [`processes/HOTFIX.md`](../processes/HOTFIX.md), and fixes forward-ported from older lines |
| `release/x.y` | Stabilisation branch for an upcoming release | Yes — fixes needed for that release to ship |
| `release/x.y.z` (published line) | Maintenance of an already-published release | Yes — eligible fixes only (§3), for that line's next patch release |

Rules that apply to every backport target:

- **Only maintained lines are eligible.** A release line receives backports
  until its end-of-support date under
  [`SECURITY_POLICY.md`](../SECURITY_POLICY.md); after that, only security
  fixes may be considered, coordinated privately through the security team.
- **The fork point is the base.** A backport is branched from the target
  release branch (or the published tag), never from `main` or `develop`.
- **No forward drift.** A backport must not introduce changes that do not
  exist, in equivalent form, in the source change. If the target line needs a
  different fix because its code diverged, that is a new change reviewed on its
  own merits, recorded in the same tracking issue.
- **Cherry-pick, then verify.** Where the change applies cleanly, it is
  cherry-picked with `-x` so the source commit is recorded. Conflicts are
  resolved by hand and documented in the pull request.

## 3. Eligibility criteria

A change is eligible for backport to a maintained release line when **all** of
the following are true:

1. **Already merged upstream.** The change has merged into the current
   development line (or is being merged as a hotfix to `main` under
   [`processes/HOTFIX.md`](../processes/HOTFIX.md)). A backport is never the
   first home of a fix.
2. **Fixes a real defect or exposure.** It corrects wrong behaviour, closes a
   security vulnerability, or repairs a regression introduced on that line.
   Conveniences, clean-ups, and new capabilities are not eligible.
3. **Impacts consumers of that line.** The defect affects users, data
   integrity, security posture, or operators of the release line, not merely
   internal code hygiene.
4. **Low regression risk.** The change is the smallest safe correction and does
   not alter the documented contract of the older line (see
   [`VERSIONING.md`](VERSIONING.md)); it ships as a PATCH on that line.
5. **Tested on the target line.** The change carries its regression tests, and
   the target line's lint, typecheck, build, and test suites pass with it
   applied.
6. **Has a tracked request.** An open issue (or the security advisory, for
   embargoed fixes) identifies the defect, the affected lines, and the
   desired backport targets.

If any criterion is not met, the change is not backported; it ships through the
normal release process instead.

## 4. Approval process

1. **Propose.** The requester comments on the tracking issue naming the source
   pull request and the target line(s), and states why the eligibility
   criteria in §3 are met. For security fixes this happens in the private
   security channel instead.
2. **Triage.** A maintainer confirms the affected lines and the eligibility of
   the change, and records the decision on the tracking issue, including any
   line that is declined and why.
3. **Prepare.** The backport branch is created from the target line
   (`backport/x.y/issue-<N>-<slug>`), the change is cherry-picked or re-applied,
   and regression tests are added or adapted to the target line.
4. **Review.** A pull request is opened against the target release branch. It
   requires the same approvals as a change to `main` per
   [`APPROVAL_REQUIREMENTS.md`](APPROVAL_REQUIREMENTS.md) — two maintainer
   approvals, including one from a code owner of the affected area for hotfix
   paths. The author must not be among the approvers.
5. **Verify.** Required CI — lint, format, typecheck, build, migrations, and
   the test suites — must pass on the backport pull request. No required
   checks may be skipped, including under incident urgency; urgency shortens
   review time, not the gates, as [`processes/HOTFIX.md`](../processes/HOTFIX.md)
   states.
6. **Merge and release.** After approval, the backport merges with the
   required merge method and ships in the target line's next patch release,
   with a changelog entry per [`CHANGELOG_POLICY.md`](CHANGELOG_POLICY.md)
   referencing the source change and the tracking issue.
7. **Forward-port.** Any backported fix must also be present in the current
   development line. Where `main` or `develop` already contains the fix this
   is automatic; otherwise a forward-port pull request is opened before the
   backport merges, so the lines never silently diverge.

Expedited handling is available for active security exposure or a severe
production incident, but only through the hotfix and security processes; the
approval, CI, and review-independence requirements above are never waived.

## 5. Relationship to other policies

- [`processes/HOTFIX.md`](../processes/HOTFIX.md) — the operational procedure
  for urgent production fixes, which backports to `main` follow.
- [`APPROVAL_REQUIREMENTS.md`](APPROVAL_REQUIREMENTS.md) — approvals and checks
  required before any change, including a backport, can merge.
- [`VERSIONING.md`](VERSIONING.md) — how the fix is versioned on the target
  line (PATCH) and the immutability of published releases.
- [`CHANGELOG_POLICY.md`](CHANGELOG_POLICY.md) — the changelog entry each
  backport requires.
- [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) — which release lines are
  supported, and how security fixes are coordinated and disclosed.

Where this policy and another governance document conflict, the more specific
document prevails for its subject matter, and the conflict is recorded as a
governance issue.

## 6. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-30 | Initial backport policy (backport targets, eligibility criteria, approval process). |
