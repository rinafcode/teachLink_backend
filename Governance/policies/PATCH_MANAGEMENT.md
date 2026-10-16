# Patch Management Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/PATCH_MANAGEMENT.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All dependencies and infrastructure in inafcode/teachLink_backend |

## 1. Patch cadence

| Patch type | Cadence |
| --- | --- |
| Critical security patches | Within 48 hours of release |
| High severity patches | Within 1 week of release |
| Medium severity patches | Within 2 weeks of release |
| Low severity patches | Monthly batch |
| Dependency updates | Monthly via Dependabot or manual review |

## 2. Prioritization

Patches are prioritized by severity:

1. **Critical**: Exploitable vulnerabilities with public proof-of-concept.
2. **High**: Vulnerabilities with known exploits but limited impact.
3. **Medium**: Vulnerabilities with mitigating controls in place.
4. **Low**: Informational or minor issues.

## 3. Emergency-patch path

For critical patches that cannot wait for the normal review cycle:

- A hotfix branch is created from `main`.
- The patch requires 1 maintainer approval (instead of the usual 2).
- The patch is deployed immediately after approval.
- A post-deployment review is conducted within 5 business days.
- The patch is back-merged to `develop`.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |