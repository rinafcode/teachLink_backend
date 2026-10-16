# Contributor Sign-Off Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-25
- **Review cadence:** Every 6 months, or after any change to the contribution or CI process

This policy defines the sign-off mechanism contributors must use when
submitting changes to the TeachLink Backend project, how those sign-offs are
recorded, and how compliance is enforced in CI. It exists so that every merged
commit carries a durable, verifiable statement that the contributor has the
right to submit the change and agrees to the project's licensing terms — rather
than relying on that agreement being implied.

This policy is part of the project's **Legal & IP** area. It lives entirely
inside the `Governance/` folder and does not change application code.

## 1. The Sign-Off Mechanism

TeachLink Backend uses the **Developer Certificate of Origin (DCO) 1.1** as its
sign-off mechanism. The full text of the DCO is available at
<https://developercertificate.org/>.

By adding a sign-off to a commit, a contributor certifies that:

- The contribution was created in whole or in part by them, and they have the
  right to submit it under the project's open-source licence; or
- The contribution is based upon a previous work that, to the best of their
  knowledge, is covered under an appropriate open-source licence and they have
  the right to submit it; or
- The contribution was provided directly to them by some other person who
  certified one of the above, and they have not modified it.

A sign-off is added by appending the following trailer to the **last line** of
a commit message, using the contributor's real name and a reachable email
address:

```
Signed-off-by: Full Name <email@example.com>
```

The easiest way to add this automatically is with the `-s` flag:

```bash
git commit -s -m "your commit message"
```

For a commit that was written without `-s`, the trailer can be added before
push:

```bash
git commit --amend -s --no-edit
```

Every commit in a pull request must carry a `Signed-off-by` trailer. A PR with
even one unsigned commit will not pass CI (see §3).

## 2. Records Kept

Sign-off records are stored in two complementary ways:

**Git history.** The `Signed-off-by` trailer is embedded in the commit object
itself and travels with the repository history. It is cryptographically bound
to the commit content by the commit hash, so any alteration of either the
message or the diff would invalidate it. Git history is the primary,
authoritative record.

**GitHub pull request.** Each pull request thread records which commits it
carried at merge time, so the sign-off status of any merged change can be
reconstructed from the GitHub audit log even without cloning the repository.

**What is never stored.** The project does not maintain a separate contributor
agreement database. The DCO model places the certification in the commit where
it is permanent and portable; a separate store would duplicate and potentially
diverge from that record.

**Correction of a missing or malformed sign-off.** If a sign-off is found to be
missing or to use a mismatched name after merge (for example, discovered during
an audit), the contributor is asked to provide a corrective statement in the
issue or pull request thread. That statement is linked from the relevant commit
in `Governance/DECISION_LOG.md`. The commit itself is never rewritten after
merge.

## 3. Enforcement in CI

Sign-off compliance is enforced automatically on every pull request by the CI
pipeline (`.github/workflows/ci.yml`). The check runs as follows:

1. **DCO check job.** The pipeline verifies that every commit in the pull
   request's commit range carries a `Signed-off-by` trailer whose email matches
   a GitHub-verified address associated with the author.
2. **Blocking gate.** The DCO check is a **required status check** on the
   `main` branch. A pull request cannot be merged until the check passes; a
   maintainer cannot override it through the GitHub UI without explicitly
   bypassing the branch protection, which is audited.
3. **Bot comment.** When the check fails, an automated comment is posted on the
   pull request identifying the unsigned commits and linking to the fix
   instructions in this document.
4. **Fix path.** The contributor rewrites the unsigned commits (via
   `git commit --amend -s` or interactive rebase for multiple commits) and
   force-pushes the branch. The CI check re-runs automatically on the new push.
5. **Bot accounts and automated commits.** Commits authored by GitHub Actions
   workflows or other project-controlled bots are exempted from the sign-off
   requirement, provided the workflow file is itself committed with a signed-off
   human author. The exemption applies only to commits that would fail the DCO
   check solely because the `GITHUB_TOKEN` actor has no associated email; it
   does not apply to automated commits that introduce substantive code changes
   without human authorship.

## 4. Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces no
runtime behaviour, no schema change, and no executable code, so it adds no tests
and requires none. The enforcement gate described in §3 is the functional
equivalent of a test for this policy: CI will fail any pull request that
violates it. Existing lint, typecheck, build, and test suites must continue to
pass, and the change is verified by the standard CI pipeline described in
`CONTRIBUTING.md`.

## 5. Review

This policy is reviewed at least every 6 months, or whenever the CI pipeline,
the contribution process, or the project's licensing terms change materially.
Changes are proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.

## 6. Related Documents

- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — the contributor guide that
  references this policy and explains the sign-off step to new contributors.
- [`Governance/policies/ATTRIBUTION.md`](ATTRIBUTION.md) — attribution rules
  for third-party code, which interacts with the DCO for contributed code that
  originates elsewhere.
- [`Governance/DECISION_LOG.md`](../DECISION_LOG.md) — where corrective
  sign-off statements are linked.

## 7. Change Log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-25 | Initial contributor sign-off policy (DCO mechanism, records, CI enforcement). |
