# Secret Rotation Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/SECRET_ROTATION.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All secrets used by inafcode/teachLink_backend |

## 1. Rotation cadence

| Secret type | Rotation frequency |
| --- | --- |
| API keys | Every 90 days |
| Database credentials | Every 90 days |
| CI/CD tokens | Every 60 days |
| Signing keys | Every 180 days |
| Service account passwords | Every 90 days |

## 2. Responsible owner

The Maintainer Team owns the rotation schedule. Each secret must have a named
individual responsible for ensuring its rotation occurs on time.

## 3. Verification requirement

After rotation, the following must be verified:

- The new secret is in use and the old secret is revoked.
- All dependent services successfully authenticate with the new secret.
- A verification log entry is recorded with the date, secret type, and verifier.

## 4. Emergency rotation

If a secret is suspected of being compromised, it must be rotated immediately
regardless of the scheduled cadence. The incident must be logged in the
Decision Log.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |