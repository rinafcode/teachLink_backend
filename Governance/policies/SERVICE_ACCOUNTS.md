# Service Account Governance Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/SERVICE_ACCOUNTS.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All service accounts used by inafcode/teachLink_backend |

## 1. How service accounts are created

- A service account is created only when a documented operational need exists.
- Each service account must have a named owner responsible for its activity.
- Service account creation requires approval from the Maintainer Team.
- Service accounts are named using the convention `sa-<purpose>` (e.g. `sa-deploy`, `sa-monitoring`).

## 2. Least-privilege rule

- Service accounts are granted only the minimum permissions required for their function.
- Permissions are reviewed quarterly and reduced when no longer needed.
- Service accounts must never be granted admin or maintain roles.
- Shared service accounts are prohibited; each service or automation must use its own account.

## 3. Review and decommission

| Activity | Frequency |
| --- | --- |
| Permission review | Quarterly |
| Activity audit | Monthly |
| Decommission review | When service is retired |

Decommission process: When a service account is no longer needed, its tokens
are revoked, its access is removed, and the account is deleted. The
decommission is recorded in the Decision Log.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |