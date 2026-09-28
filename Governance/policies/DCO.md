# Developer Certificate of Origin (DCO) Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or after any change to the contribution or CI process

This policy states the **Developer Certificate of Origin (DCO) 1.1**
requirement for contributions to TeachLink Backend, how sign-off is verified,
and how missing sign-off is remediated. It lives entirely inside the
`Governance/` folder and does not change application code.

The operational sign-off workflow (commit trailer format, CI behavior, and
records) is also described in
[`CONTRIBUTOR_SIGNOFF.md`](CONTRIBUTOR_SIGNOFF.md). Where that document and
this policy overlap, both apply; this file is the canonical **DCO** policy
reference requested for governance completeness.

## 1. Sign-Off Requirement

Every commit submitted to this repository **must** include a DCO sign-off
trailer on the last line of the commit message:

```
Signed-off-by: Full Name <email@example.com>
```

Use your real name and a reachable email address. The Git convenience flag
is:

```bash
git commit -s -m "Describe the change"
```

By signing off, the contributor certifies the statements of the
[Developer Certificate of Origin 1.1](https://developercertificate.org/),
including that they have the right to submit the work under the project’s
license.

Pull requests that contain any commit without a valid `Signed-off-by`
trailer are not eligible to merge.

## 2. How Sign-Off Is Verified

| Check | Mechanism |
|-------|-----------|
| Presence of trailer | CI (or a required status check) scans each commit in the PR range for `Signed-off-by:` |
| Format | Trailer must match `Signed-off-by: Name <email>` with a plausible email |
| Authorship alignment | Name/email should match the commit author unless maintainers accept a documented exception (e.g. corporate contribution under a known CLA/DCO process) |
| Historical commits | Rebase or squash workflows must preserve or recreate sign-off on the commits that land on the default branch |

Maintainers may re-run verification locally with tools such as
`git log --format='%H %s %b' | grep -i signed-off` or a DCO bot configured
on the repository.

## 3. Remediation for Missing Sign-Off

If CI or review finds a missing or invalid sign-off:

1. **Author amends or rebases** the affected commits with `git commit --amend -s --no-edit` or an interactive rebase that re-applies `-s`, then force-pushes the PR branch per project norms.
2. **If the author cannot amend** (e.g. commit already depended on by others), open a follow-up commit is **not** sufficient for the unsigned historical commit; the history must be rewritten so every landed commit carries sign-off, or the change must be re-submitted as a new signed commit series.
3. **Repeated failure** to provide DCO sign-off after guidance may result in the PR being closed until the policy is followed; this is a process requirement, not a judgement on the technical merit of the change.

Exceptions (rare) require maintainer written approval recorded in the PR
discussion and must still satisfy the project’s license and IP expectations.

## 4. Document History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial DCO policy document (issue #1609) |
