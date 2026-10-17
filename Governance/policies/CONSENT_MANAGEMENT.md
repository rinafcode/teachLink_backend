# Consent Management Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/CONSENT_MANAGEMENT.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | Any processing activity that relies on consent as its legal basis |
| Related | [`policies/DATA_DELETION.md`](DATA_DELETION.md) · [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md) · [`policies/DATA_RESIDENCY.md`](DATA_RESIDENCY.md) |

This policy defines what requires consent, how consent is recorded so the project
can prove it was given, and how consent is withdrawn. Consent is one legal basis
among several; this policy applies only where the project relies on it.

## 1. What requires consent

Consent is required before the project:

- sends **marketing or product emails** that are not transactional;
- uses **optional analytics, telemetry, or tracking** beyond what is strictly
  necessary to operate the service;
- publishes a user's **content, name, or affiliation** beyond the purpose they
  gave it for;
- processes **special-category or sensitive data** (for example, health or
  biometric data) or children's data, where applicable;
- shares data with a **third party for a purpose other than operating the
  service**.

Consent is **not** required for processing that is necessary to perform a
contract, to comply with a legal obligation, to protect vital interests, or for
a legitimate interest that has been assessed and documented. Do not use consent
as a fallback for processing that another basis already covers — bundling
optional consent into the core service is not consent.

## 2. How consent is recorded

- **Opt-in, never pre-ticked.** Consent is an affirmative action. Pre-ticked
  boxes, "by continuing you agree" for optional processing, and silence are not
  consent.
- **Separate and specific.** Each distinct purpose has its own consent; do not
  bundle marketing consent with terms acceptance or with another purpose.
- **Record the evidence.** For each consent, store:
  - the identity of the data subject (or a stable, non-sensitive reference);
  - the **purpose** consented to;
  - the **version** of the notice shown at the time;
  - the **timestamp**;
  - **how** it was given (channel or UI surface);
  - the **withdrawal** state and, once withdrawn, when.
- **Access-limited storage.** Consent records are themselves personal data,
  classified per [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md),
  access-restricted, and not used for any other purpose.
- **Retention.** Keep consent records only as long as needed to demonstrate
  compliance; retain the fact of withdrawal even after the underlying data is
  deleted.

## 3. How consent is withdrawn

- **As easy to withdraw as to give.** Withdrawing consent uses a channel at least
  as simple as the one used to give it — an unsubscribe link, a settings toggle,
  or a support request — with no extra steps and no dark patterns.
- **Withdrawal stops future processing promptly.** Optional processing that
  relied on consent stops within a reasonable operational window, and always by
  the next processing cycle.
- **No penalty.** Withdrawing optional consent does not degrade access to the
  core service the user is entitled to.
- **Record the withdrawal.** Update the consent record with the withdrawal time
  and the processing it affects. Where the data has no other lawful basis,
  withdraw-and-delete follows [`policies/DATA_DELETION.md`](DATA_DELETION.md).
- **No retroactive erasure under consent alone.** Withdrawal stops future
  processing; erasure of data processed before withdrawal is governed by the
  deletion policy and any applicable rights.

## 4. Review and enforcement

- Before a new processing activity launches, the owner confirms the basis and,
  where it is consent, that §1–§3 are implemented.
- The maintainers review this policy and the active consent purposes at least
  **every 6 months**, and whenever a purpose or processor changes.
- A processing activity found running on invalid consent is paused until it is
  fixed, and the incident is documented per
  [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) where personal data was exposed.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
