# Bot and Automation Governance Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/BOT_AUTOMATION.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All bots and automated systems interacting with inafcode/teachLink_backend |

## 1. Allowed automations

| Automation | Purpose | Allowed |
| --- | --- | --- |
| CI/CD pipelines | Build, test, and deploy | Yes |
| Dependency bots (e.g. Dependabot) | Security updates | Yes |
| Issue/PR labelling bots | Triage assistance | Yes |
| Auto-merge bots | Merging approved PRs | No (manual merge only) |
| Web scrapers | Data collection | No |

## 2. Permissions

Bots must operate with the principle of least privilege:

- CI/CD tokens: read access to repository contents, write access to deployment targets only.
- Dependency bots: read access to manifests, write access to create PRs only.
- Labelling bots: write access to issue labels only.
- No bot may have admin or maintain role on the repository.

## 3. Review and audit

- All bot activities are logged and auditable.
- Bot permissions are reviewed quarterly by the Maintainer Team.
- Any new bot must be approved by the Maintainer Team before deployment.
- Bots that are no longer needed must be deactivated and their tokens revoked.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |