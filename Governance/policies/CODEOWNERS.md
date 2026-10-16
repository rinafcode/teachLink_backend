# CODEOWNERS Governance Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/CODEOWNERS.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All code paths in inafcode/teachLink_backend |

## 1. How ownership is assigned

Ownership is assigned based on area of responsibility:

- Each major directory (e.g. `src/auth`, `src/database`, `src/api`) has a
  designated owner.
- Owners are listed in a `CODEOWNERS` file at the repository root.
- Ownership is assigned to GitHub teams or individual maintainers.
- Every code path must have at least one owner.

## 2. Required-review implications

- Any PR touching files under a CODEOWNERS rule requires approval from the
  listed owner.
- If multiple owners are listed for a path, at least one must approve.
- Owners cannot approve their own PRs; another owner or maintainer must review.
- Security-sensitive paths require **2** owner approvals per the Approval
  Requirements Policy.

## 3. Update process

- CODEOWNERS changes require Maintainer Team approval.
- Ownership reassignments are proposed via PR and documented in the PR
  description.
- The CODEOWNERS file is reviewed quarterly to ensure owners are still active.
- Inactive owners (per the Inactivity Policy) are reassigned.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |