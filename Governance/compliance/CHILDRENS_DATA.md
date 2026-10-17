# Children's Data Policy

| Field | Value |
| --- | --- |
| Document | `Governance/compliance/CHILDRENS_DATA.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | Any processing of personal data relating to children |
| Related | [`policies/CONSENT_MANAGEMENT.md`](../policies/CONSENT_MANAGEMENT.md) · [`policies/PRIVACY_POLICY_GOVERNANCE.md`](PRIVACY_POLICY_GOVERNANCE.md) · [`policies/DATA_DELETION.md`](../policies/DATA_DELETION.md) |

This policy sets what the project does when its service is used by, or its data
concerns, a child. It applies wherever the project determines the purposes of
processing; where a customer controls the data, the customer's obligations apply
and the project assists them.

## 1. Is the service for children?

- **Not directed at children by default.** The platform is intended for adult
  learners and educators; it is not designed for, and does not solicit, users
  below the applicable age of digital consent.
- **Age of consent differs by region.** The minimum age is the applicable age in
  the user's jurisdiction — commonly **13** in some regions and up to **16** in
  others. Where the two conflict, the higher protection applies.
- **No knowing collection.** The project does not knowingly collect personal data
  from children below the applicable age without a valid lawful basis, normally
  verifiable parental or guardian consent.
- **Age assurance, proportionately.** Where a feature could plausibly attract
  younger users, the project uses proportionate age screening or self-declaration
  rather than collecting more identity data than necessary.

## 2. If children's data is involved

- **Lawful basis.** Processing children's data requires a documented lawful
  basis; where consent is the basis, it must be given or authorised by the holder
  of parental responsibility and recorded per
  [`policies/CONSENT_MANAGEMENT.md`](../policies/CONSENT_MANAGEMENT.md).
- **Data minimisation.** Collect the least children's data that the purpose
  requires; do not use it for profiling, advertising, or any purpose unrelated to
  the educational service.
- **No behavioural advertising** to children, and no sale of children's data.
- **Higher classification.** Children's data is treated as high-sensitivity under
  [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md): access is
  restricted to those who need it, storage is encrypted, and retention is
  minimised.
- **Deletion.** A request to delete a child's data is handled promptly under
  [`policies/DATA_DELETION.md`](../policies/DATA_DELETION.md), including a request
  made by a parent or guardian.
- **Mental-health and wellbeing content** receives particular care: it does not
  diagnose, and it points to qualified human support rather than standing alone.

## 3. Discovery and remediation

- **If we learn a child's data was collected without a basis**, we stop the
  processing, notify the affected account or guardian, and delete the data, in
  line with [`policies/DATA_DELETION.md`](../policies/DATA_DELETION.md).
- **Incident handling.** A suspected breach involving children's data is handled
  as a security incident under [`SECURITY_POLICY.md`](../SECURITY_POLICY.md), with
  notification decisions made promptly given the heightened risk.
- **Records.** The fact, nature, and resolution of a children's-data issue are
  recorded in a restricted register for accountability.

## 4. Review

The maintainers review this policy at least **every 6 months**, and whenever the
platform adds a feature aimed at younger learners or a new region with a
different age threshold.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
