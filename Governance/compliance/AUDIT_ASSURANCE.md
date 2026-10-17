# Audit and Assurance Policy

| Field | Value |
| --- | --- |
| Document | `Governance/compliance/AUDIT_ASSURANCE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 12 months |
| Applies to | Internal reviews and third-party assessments of the project's controls |
| Related | [`policies/TRANSPARENCY_REPORTS.md`](../policies/TRANSPARENCY_REPORTS.md) · [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) · [`compliance/SANCTIONS.md`](SANCTIONS.md) |

This policy describes how the project seeks assurance that its security, privacy,
and governance controls work — through internal review and, where warranted,
independent third-party assessment — and how the results are recorded and shared.

## 1. What assurance covers

- **Security controls:** authentication, authorisation, dependency hygiene,
  secret rotation ([`policies/SECRET_ROTATION.md`](../policies/SECRET_ROTATION.md)),
  and the vulnerability remediation clock
  ([`policies/VULN_SLA.md`](../policies/VULN_SLA.md)).
- **Privacy controls:** data classification, retention, deletion, and consent, per
  [`domains/DATA_CLASSIFICATION.md`](../domains/DATA_CLASSIFICATION.md),
  [`domains/DATA_RETENTION.md`](../domains/DATA_RETENTION.md), and
  [`policies/CONSENT_MANAGEMENT.md`](../policies/CONSENT_MANAGEMENT.md).
- **Governance controls:** decision-making, contribution records, licensing and
  attribution, and sanctions/compliance screening.
- **Availability and change management:** release sign-off, rollback, and the
  meeting/decision cadence.

## 2. Levels of assurance

| Level | Who performs it | Typical trigger |
| --- | --- | --- |
| **Self-assessment** | Maintainers and contributors | Routine, at least **every 12 months** per area |
| **Internal review** | A maintainer independent of the area under review | After a significant incident or a control change |
| **Independent third-party assessment** | An external assessor engaged by the project | Before a major release, on sponsor/grant request, or after a serious incident |

- **Independence.** The reviewer of a control is not the person who built or
  operates it. For internal review, "independent" means a maintainer with no
  authorship of the area.
- **Proportionate effort.** The depth of an assessment matches the risk and the
  size of the change; a small documentation change does not warrant a full
  external audit.

## 3. How an assessment is run

1. **Scope.** Define the controls, systems, and period covered, and the standard
   against which they are assessed.
2. **Evidence.** The assessor works from the actual repositories, configuration,
   and records — not from assurances alone.
3. **Findings.** Each finding is recorded with a severity, so it can be tracked
   like any other risk, and remediated under the relevant policy.
4. **Report.** The assessor produces a written report: scope, method, findings,
   and limitations.
5. **Remediation.** Findings are tracked to closure with owners and dates;
   Critical and High findings follow the escalation in
   [`policies/VULN_SLA.md`](../policies/VULN_SLA.md) where security-related.

## 4. Reporting and confidentiality

- **What is shared publicly.** A summary of the assessment — scope, date, and
  remediation status — is published in the appropriate parts of
  [`policies/TRANSPARENCY_REPORTS.md`](../policies/TRANSPARENCY_REPORTS.md).
- **What stays private.** Exploitable detail, personal data, and anything that
  would weaken security is **not** published until fixed; sensitive findings are
  handled under [`SECURITY_POLICY.md`](../SECURITY_POLICY.md).
- **Records.** Reports and remediation evidence are retained in a restricted
  location for the period needed to demonstrate due diligence, then disposed of.

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
