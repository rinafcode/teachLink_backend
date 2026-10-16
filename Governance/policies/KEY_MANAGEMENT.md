# Key Management Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/KEY_MANAGEMENT.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All cryptographic keys used by inafcode/teachLink_backend |

## 1. Key lifecycle

| Stage | Description |
| --- | --- |
| Generation | Keys are generated using approved algorithms and sufficient length. |
| Distribution | Keys are distributed via secure channels only. |
| Usage | Keys are used only for their intended purpose. |
| Rotation | Keys are rotated per the schedule below. |
| Revocation | Compromised keys are revoked immediately. |
| Destruction | Revoked keys are securely destroyed after retention period. |

## 2. Storage and access rules

- Keys must never be stored in the repository or committed to git.
- Keys are stored in a approved secret manager (e.g. GitHub Secrets, environment variables in CI/CD).
- Access to keys is limited to the Maintainer Team and CI/CD pipelines.
- Key access is logged and auditable.

## 3. Rotation and revocation

| Key type | Rotation frequency |
| --- | --- |
| CI/CD signing keys | Every 180 days |
| API signing keys | Every 90 days |
| Deployment keys | Every 90 days |

Revocation: Any key suspected of compromise must be revoked immediately and a
new key generated. The incident must be recorded in the Decision Log.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |