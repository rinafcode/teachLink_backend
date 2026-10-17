# Data Deletion and Right-to-Erasure Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/DATA_DELETION.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | Requests to delete personal data held by the platform |
| Related | [`domains/DATA_RETENTION.md`](../domains/DATA_RETENTION.md) · [`policies/CONSENT_MANAGEMENT.md`](CONSENT_MANAGEMENT.md) · [`domains/BACKUP_POLICY.md`](../domains/BACKUP_POLICY.md) |

This policy defines how a deletion or erasure request is handled, the timelines
that apply, and how the identity of the requester is verified before data is
removed. It covers data the project controls; data a customer controls in their
own tenancy follows the agreement with that customer.

## 1. How requests are handled

1. **Receive.** A request may arrive through the published privacy contact or
   the in-product mechanism named in the privacy policy. Log it with the date
   and time of receipt.
2. **Acknowledge.** Confirm receipt **within 3 business days**, without yet
   confirming that the data exists.
3. **Verify identity** per §3 before acting.
4. **Locate.** Identify every system that holds the requester's data — the
   primary store, caches, search indexes, logs, backups, and any processor
   recorded in [`compliance/DPA_TEMPLATE.md`](../compliance/DPA_TEMPLATE.md).
5. **Assess exceptions.** Determine whether any data must be retained for a
   legal, accounting, security, or contractual reason (see §5). Retain only what
   is required, and say what is retained and why.
6. **Delete or anonymise.** Remove the data, or irreversibly anonymise it where
   deletion is not possible.
7. **Confirm.** Tell the requester the outcome and, where data was retained, the
   reason and the retention period.

## 2. Timelines

| Stage | Target |
| --- | --- |
| Acknowledgement of receipt | 3 business days |
| Identity verification (requester's side) | as soon as the requester responds |
| Substantive response / completion | 30 calendar days from verified receipt |
| Extension for complex requests | up to 60 further days, with notice and reason |
| Propagation to backups | within the next backup rotation, not later than the retention window |
| Propagation to processors | within 30 calendar days, or per the processor DPA |

An extension is communicated before the original deadline passes, with the
reason and the expected completion date. The default is to complete early, not to
use the full window.

## 3. Verification

- **Verify before deleting.** A deletion request is not actioned on the word of
  an unauthenticated sender, because deletion is irreversible and could be used
  to destroy another person's data.
- **Proportionate proof.** Confirm control of the account or email on file. For
  data the requester can see in-product, an authenticated session may be enough;
  for a request that would delete a whole account, re-authenticate.
- **No over-collection.** Do not ask for more identity documents than the
  verification needs; the minimum to confirm control is the rule.
- **Agents.** A request from an authorised agent is verified as if from the data
  subject, plus evidence of the agent's authority.
- **Failed verification.** If identity cannot be verified, do not delete; explain
  what is needed and keep the request open.

## 4. What deletion means

- **Deletion is real.** Removing a row from the primary store is not enough if a
  cache, index, or log still holds it. "Deleted" means the data is no longer
  retrievable by the project through ordinary means.
- **Backups.** Data in immutable backups is not surgically edited; instead it is
  excluded from restores and expires on the backup retention schedule in
  [`domains/BACKUP_POLICY.md`](../domains/BACKUP_POLICY.md). The requester is told
  this is how backup copies are handled.
- **Anonymisation.** Where a record must be kept for aggregate analytics, remove
  the identifiers so the record can no longer be linked to a person.
- **Derived data.** Recompute or remove derived datasets (reports, exports,
  caches) so the deletion is not undone by a stale copy.

## 5. Lawful retention and exceptions

A request may be refused or partially fulfilled where retention is required:

- to comply with a legal or regulatory obligation;
- to establish, exercise, or defend legal claims;
- to prevent fraud or preserve the integrity of a security investigation;
- where deletion would infringe another person's rights.

A refusal states the specific basis and the retention period, and is reviewed by
a maintainer who is not the original handler. Retained data is minimised, access-
restricted, and deleted as soon as the basis ends.

## 6. Records

Every request and its outcome are recorded (date received, verification method,
systems touched, decision, and retention basis) in a restricted record for
audit. Personal detail is not put in a public issue or pull request.

## 7. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
