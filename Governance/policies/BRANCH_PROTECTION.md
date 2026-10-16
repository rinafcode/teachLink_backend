# Branch Protection Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/BRANCH_PROTECTION.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All protected branches in inafcode/teachLink_backend |

## 1. Protected branches

| Branch | Protected |
| --- | --- |
| `main` | Yes |
| `develop` | Yes |
| `release/*` | Yes |
| All other branches | No |

## 2. Required checks and approvals

| Requirement | `main` | `develop` | `release/*` |
| --- | --- | --- | --- |
| Minimum approvals | 2 | 1 | 1 |
| Code-owner approval | Yes (for relevant paths) | Yes (for relevant paths) | Yes |
| `validate` check | Required | Required | Required |
| `No build artifacts` | Required | Required | Required |
| DCO sign-off | Required | Required | Required |
| Linear history | Required | Required | Required |
| Force push | Prohibited | Prohibited | Prohibited |
| Direct push | Prohibited | Prohibited | Prohibited |

## 3. Override rules

- Overrides follow the Approval Requirements Policy (§5).
- No override may disable branch protection rules.
- Emergency overrides are documented in the Decision Log within 24 hours.
- Branch protection settings may only be changed by repository admins with
  Maintainer Team approval.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |