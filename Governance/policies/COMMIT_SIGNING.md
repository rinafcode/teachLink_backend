# Commit Signing Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/COMMIT_SIGNING.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-16 |
| Review cadence | Every 6 months |
| Applies to | All commits in inafcode/teachLink_backend |

## 1. Signing requirement

- All commits merged to `main` and `develop` must be signed.
- Accepted signing methods: GPG-signed commits and SSH-signed commits.
- Commits must be verified by GitHub (shown as `Verified` on GitHub).
- Unsigned commits will be rejected by branch protection.

## 2. Verification in CI

- The CI pipeline verifies commit signatures on every PR.
- A PR containing unsigned commits will fail the `validate` check.
- The `Signed-off-by:` trailer (DCO) is required in addition to commit
  signing — they serve different purposes.

## 3. Key management

- Contributors generate their own signing keys and register the public key with
  GitHub.
- Signing keys must be protected with a passphrase.
- If a signing key is compromised, the contributor must revoke it, generate a
  new key, and notify the Maintainer Team.
- Lost keys require regeneration and re-registration with GitHub.

## 4. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-16 | 1.0.0 | Initial release. |