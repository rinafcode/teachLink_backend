# Data Residency Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/DATA_RESIDENCY.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months, and before adding any new region or processor |
| Applies to | All personal and project data processed by or for the platform |
| Related | [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md) · [`compliance/DPA_TEMPLATE.md`](../compliance/DPA_TEMPLATE.md) · [`domains/BACKUP_POLICY.md`](../domains/BACKUP_POLICY.md) |

This policy states where project data may be stored and processed, the
restrictions on moving it between regions, and the process for approving an
exception. It exists so that a database, backup, or log file never lands in a
jurisdiction we have not deliberately approved.

## 1. Where data may be stored

- **By default, in the primary region.** Production data is stored and processed
  in the project's **primary region**, which is recorded in the platform's
  infrastructure configuration and referenced in the deployment runbooks.
- **Approved regions only.** A region is "approved" only after the maintainers
  have assessed its legal and operational suitability and recorded it in the
  region register below. Processing outside an approved region is a policy
  breach.
- **Region register.**

  | Region | Status | Approved for | Notes |
  | --- | --- | --- | --- |
  | Primary region (see deployment config) | Approved | All classified data up to the highest sensitivity handled there | Default for production and backups. |

  New rows are added by the process in §3; the register is the authoritative list.
- **Data classification constrains residency.** Data classified as restricted in
  [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md) may only
  live in an approved region, and never in a region marked for lower-sensitivity
  data only.

## 2. Transfer restrictions

- **No cross-border transfer without a basis.** Personal data may only be moved
  to another region when there is a lawful transfer mechanism and a recorded
  risk assessment. "The provider defaults to it" is not a basis.
- **Encrypted in transit and at rest.** Any transfer between regions uses
  transport encryption and the destination stores data encrypted, per
  [`policies/ENCRYPTION.md`](ENCRYPTION.md).
- **Minimise the move.** Transfer the least data necessary; prefer aggregate or
  pseudonymised data when the purpose allows.
- **Sub-processors count.** A processor's own region counts as a storage
  location; new sub-processors are recorded under
  [`compliance/DPA_TEMPLATE.md`](../compliance/DPA_TEMPLATE.md) before use.
- **Backups and logs follow the data.** Backups and log archives inherit the
  residency rules of the data they contain; see
  [`domains/BACKUP_POLICY.md`](../domains/BACKUP_POLICY.md) and
  [`domains/LOGGING_RETENTION.md`](../domains/LOGGING_RETENTION.md).

## 3. Exception process

1. **Open an issue** describing the data, its classification, the source and
   destination region, the reason, and the proposed safeguards.
2. **Assess the transfer** — the lawful mechanism, the risk, and the retention.
   A maintainer who is not the requester reviews it.
3. **Approve or decline in writing**, recording the decision and any conditions
   on the issue and in the region register.
4. **Time-box the exception.** An exception is scoped and reviewed; it does not
   silently become the default.
5. **Emergency transfers** for incident response may proceed under
   [`processes/ESCALATION_PATH.md`](../processes/ESCALATION_PATH.md) and are
   documented retrospectively within **5 business days**.

## 4. Monitoring and review

- The maintainers review this policy and the region register at least **every 6
  months**, and whenever a new region, processor, or classification is added.
- Any processing found outside an approved region is treated as an incident:
  contain it, document it, and remediate, in line with
  [`SECURITY_POLICY.md`](../SECURITY_POLICY.md).

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
