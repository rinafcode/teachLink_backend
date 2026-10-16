# CI/CD Governance Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/CICD_GOVERNANCE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All CI/CD pipelines in inafcode/teachLink_backend |

## 1. Who may change pipelines

- Only maintainers may modify CI/CD pipeline configurations (`.github/workflows/`).
- Pipeline changes require a PR with at least 2 maintainer approvals.
- Emergency pipeline fixes may be merged with 1 approval but require a
  post-merge review within 24 hours.
- No direct pushes to `main` or `develop` are permitted for pipeline files.

## 2. Secret and permission rules

- CI/CD secrets are stored in GitHub Secrets only, never in the repository.
- Secrets are scoped to the minimum required environment.
- Pipeline tokens use least-privilege permissions.
- Secret rotation follows the Secret Rotation Policy.
- No secret values may appear in logs or build output.

## 3. Required-check policy

- Every PR must pass the `validate` check (lint, typecheck, build, migrations).
- The `No build artifacts in git` check must pass on every PR.
- Security scans run on every PR and are advisory during phased rollout.
- Pipeline changes must not disable or bypass required checks.
- Any new required check must be documented in this policy before enforcement.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |