# Privacy Policy Governance

| Field | Value |
| --- | --- |
| Document | `Governance/compliance/PRIVACY_POLICY_GOVERNANCE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team, in consultation with the project's data-protection contact |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months, and on any material change to data processing |
| Applies to | The public privacy policy that describes how the platform handles personal data |
| Related | [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md) · [`domains/DATA_RETENTION.md`](../domains/DATA_RETENTION.md) · [`compliance/DPA_TEMPLATE.md`](DPA_TEMPLATE.md) |

This document defines **who owns** the project's privacy policy, **how** it is
updated and reviewed, and **how** it is versioned. It governs the process, not
the legal content; the published policy itself may live outside this repository,
but every change to it follows the process below.

## 1. Who owns the privacy policy

- The **maintainer team** owns the privacy policy and is accountable for keeping
  it accurate and published. See [`roles/MAINTAINER.md`](../roles/MAINTAINER.md).
- A **data-protection contact** (a named maintainer or an external advisor acting
  for the project) is responsible for the substantive review: whether the policy
  matches what the system actually does.
- The **treasurer** reviews any part of the policy that touches payment or
  financial data, with the treasurer's duties in [`roles/TREASURER.md`](../roles/TREASURER.md).
- Where processing is performed by a processor, the relationship is recorded
  using [`compliance/DPA_TEMPLATE.md`](DPA_TEMPLATE.md).

## 2. What the policy must cover

The policy, at minimum, must state:

- what personal data is collected and for what purpose;
- the legal basis relied on for each processing activity;
- how long data is retained and how it is deleted (see
  [`domains/DATA_RETENTION.md`](../domains/DATA_RETENTION.md) and
  [`policies/DATA_DELETION.md`](../policies/DATA_DELETION.md));
- who data is shared with, including sub-processors and any cross-border transfer
  (see [`policies/DATA_RESIDENCY.md`](../policies/DATA_RESIDENCY.md));
- the data-subject rights available and how to exercise them, including consent
  withdrawal (see [`policies/CONSENT_MANAGEMENT.md`](../policies/CONSENT_MANAGEMENT.md));
- how children's data is handled (see [`compliance/CHILDRENS_DATA.md`](CHILDRENS_DATA.md));
- the contact channel for privacy questions and complaints.

The classification vocabulary used to describe the data is defined in
[`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md).

## 3. Update and review process

1. **Trigger.** A change is opened when the system's data handling changes, when
   a new processor or transfer is introduced, when a legal requirement changes,
   or on the scheduled review date, whichever is first.
2. **Proposal.** An issue is opened describing the change and the processing
   activity it reflects. The change is made as a pull request that stays within
   `Governance/` for the process record.
3. **Substantive review.** The data-protection contact confirms the policy still
   matches the system. A change that alters a legal basis, a retention period,
   or a transfer also requires maintainer approval.
4. **Cross-check.** The reviewer confirms the policy is consistent with
   [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md) and
   [`domains/DATA_RETENTION.md`](../domains/DATA_RETENTION.md) and that the
   promises made are implementable.
5. **Approval.** At least one maintainer who is not the author approves, then the
   change is merged and, when it affects users, published as §4 requires.
6. **Scheduled review.** Even with no trigger, the policy is reviewed at least
   **every 6 months** and the review date recorded here.

## 4. Versioning and notification

- Every published policy carries a **version** (semantic `MAJOR.MINOR.PATCH`) and
  an **effective date**. Material changes increment `MAJOR`; clarifications
  increment `MINOR`; typo fixes increment `PATCH`.
- The current version and its history are kept **in this document's change log**
  and in the published policy itself, so a user can see what changed and when.
- A material change is notified to users through the product's normal notice
  channel (in-product notice or email to registered contacts) **before** it takes
  effect, with a reasonable advance window, unless a legal requirement dictates
  otherwise.
- Prior versions are kept for an audit trail; do not delete a superseded version
  from the history.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
