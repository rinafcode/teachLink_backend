# Terms of Service Governance

| Field | Value |
| --- | --- |
| Document | `Governance/compliance/TERMS_OF_SERVICE_GOVERNANCE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team, with legal review where required |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 12 months, and on any material change to the service |
| Applies to | The public terms of service that govern use of the platform |
| Related | [`compliance/PRIVACY_POLICY_GOVERNANCE.md`](PRIVACY_POLICY_GOVERNANCE.md) · [`policies/DEPRECATION.md`](../policies/DEPRECATION.md) |

This document defines **who owns** the terms of service, the **update and
approval process**, and the **user-notification rule** for changes. It governs
the process; the published terms themselves may live outside this repository, but
every change follows the process below.

## 1. Who owns the terms

- The **maintainer team** owns the terms and is accountable for keeping them
  current and published.
- **Legal review** is required for any change that alters liability, dispute
  resolution, acceptable use, or termination. Where the project has no in-house
  counsel, the maintainers obtain external review before publishing.
- **Product owners** of a feature that changes what users may do must flag the
  change so the terms can be updated before the feature ships.
- The **privacy policy** is owned separately under
  [`compliance/PRIVACY_POLICY_GOVERNANCE.md`](PRIVACY_POLICY_GOVERNANCE.md); the
  two documents must not contradict each other.

## 2. What the terms must cover

At minimum: acceptable use, account responsibilities, intellectual-property and
licence terms, fees and payment terms where applicable, availability and support
expectations, suspension and termination, disclaimers and limitation of
liability, governing law, and how disputes are resolved. Feature-specific rules
(for example rate limits or API fair use) must be reachable from the terms rather
than existing only in code.

## 3. Update and approval process

1. **Trigger.** A change is opened when a feature changes user obligations, when
   a legal or regulatory requirement changes, or on the scheduled review date.
2. **Proposal.** An issue describes the change and the user-facing behaviour it
   reflects. The change to the process record is made as a pull request inside
   `Governance/`.
3. **Review.**
   - A maintainer who is not the author confirms the terms match the service.
   - Legal review is required for the categories listed in §1.
   - The privacy-policy owner is consulted if the change touches data use.
4. **Approval.** A material change requires approval by at least **two
   maintainers**, one of whom must not be the author. Legal sign-off, where
   required, is recorded on the issue.
5. **Effective date.** Approval sets an **effective date** that allows the notice
   period in §4 to run before the new terms bind users.
6. **Scheduled review.** Even without a trigger, the terms are reviewed at least
   **every 12 months**.

## 4. User-notification rule

- **Material changes are notified before they take effect.** A reasonable advance
  notice is given through the product's standard channel (in-product notice or
  email to registered contacts) before the effective date, unless a legal or
  security requirement dictates a shorter or immediate change.
- **The notice must say what changed and when it takes effect**, and link the new
  version. It is not enough to change the document silently.
- **Non-material changes** (typo fixes, formatting, clarifying wording that does
  not change meaning) may be published without a notice but still increment the
  version.
- **Where continued use constitutes acceptance**, the notice must say so and give
  users a way to stop using the service. Changes that increase a user's
  obligations without a lawful basis to impose them cannot rely on continued use
  alone.

## 5. Versioning

- Every published version carries a version and an effective date. Material
  changes increment the major version; clarifications the minor; typo fixes the
  patch.
- The version history and the notice sent for each material change are recorded
  in this document's change log and in the published terms.
- Superseded versions are retained for the audit trail.

## 6. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
