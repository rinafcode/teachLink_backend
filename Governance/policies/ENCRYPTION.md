# Encryption Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/ENCRYPTION.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All data processed and stored by inafcode/teachLink_backend |

## 1. In-transit and at-rest requirements

- **In transit**: All data transmitted over networks must use TLS 1.2 or higher.
- **At rest**: All sensitive data stored in databases or file systems must be encrypted.
- **Backups**: All backups must be encrypted using the approved algorithms.

## 2. Approved algorithms

| Purpose | Approved algorithms |
| --- | --- |
| Symmetric encryption | AES-256 |
| Asymmetric encryption | RSA-2048 or higher, Ed25519 |
| Hashing | SHA-256, SHA-3 |
| Key exchange | ECDHE, DHE |
| TLS | TLS 1.2+, TLS 1.3 preferred |

The following algorithms are **prohibited**: DES, 3DES, RC4, MD5 (for security purposes), SHA-1.

## 3. Exception process

Any exception to this policy must be:

1. Documented with a justification and risk assessment.
2. Approved by the project lead.
3. Time-limited with a defined remediation date.
4. Recorded in the Decision Log.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |