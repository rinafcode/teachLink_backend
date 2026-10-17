# Security Posture Report

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers & Security Group (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-01-01
- **Review cadence:** Quarterly, or immediately after any security incident or
  material change to the security controls it references

This document defines how TeachLink Backend produces and publishes its
**security posture reports**: the metrics each report discloses, how often
reports are produced, who receives them, and where the canonical copy lives.
It exists so that contributors, maintainers, and downstream users have a
predictable, versioned record of the project's security health — rather than
relying on ad-hoc commentary or informal channel messages.

This document is part of the project's **Security & disclosure** governance
area. It lives entirely inside the `Governance/` folder and does not change
application code.

## 1. Scope

This document covers the project's periodic security posture reporting. It
governs:

- The **metrics** each report discloses (§2).
- The **report cadence** — how often reports are produced and published (§3).
- The **audience** — who receives each report and how (§4).
- The **publication location** and retention rules (§5).
- The **ownership, review, and correction** process (§6).

It does not govern:

- Transparency reports (`Governance/policies/TRANSPARENCY_REPORTS.md`), which
  cover broader community metrics beyond security.
- Public operational metrics (`Governance/policies/PUBLIC_METRICS.md`), which
  govern the Prometheus scrape surface.
- Incident postmortems (`Governance/domains/POSTMORTEM_POLICY.md`), which are
  incident-specific documents and remain authoritative for their own subject
  matter.
- The audit log itself (`Governance/domains/AUDIT_LOG.md`), which is the
  source of record for audited security events feeding §2.

Where a metric here is derived from an audited or governed source, the source
document prevails.

## 2. Metrics Disclosed

Each report discloses the metrics below for the period it covers. Metrics are
reported as aggregate counts, rates, or states. No individual user, contributor,
reporter, or credential value is identified in any report.

### 2.1 Vulnerability and Dependency Health

- Number of vulnerability reports received via the project's responsible
  disclosure process, and how many were triaged, remediated, and disclosed.
- Number of published security advisories.
- Number of open, high, and critical findings surfaced by `npm audit` at the
  time of the report. Findings are counted by severity; affected packages are
  named at the level needed to be actionable, but no credential or exploitable
  detail is included.
- Number of dependencies reviewed and approved or rejected under
  `Governance/domains/DEPENDENCY_APPROVAL.md` during the period.
- SBOM generation status per the current release, per
  `Governance/domains/SBOM_POLICY.md` — whether a current SBOM exists,
  passes validation, and is published to the canonical location.

### 2.2 Secret Rotation Compliance

- For each secret class in `Governance/domains/SECRETS_MANAGEMENT.md` §4.1:
  whether the maximum rotation interval was met during the period.
- Number of out-of-schedule, trigger-driven rotations performed (count only;
  no secret class, actor, or exposed value is named in the public report).
- Whether the weekly automated rotation job
  (`SecretsManagerService.rotateCriticalSecrets`) succeeded for every scheduled
  run in the period, or how many runs failed and were remediated.

### 2.3 Access Control and Privilege

- Number of privilege grants and revocations during the period, by role class
  (`Governance/domains/ACCESS_CONTROL.md`), at the category level only.
- Number of access reviews completed against the review cadence defined in
  `Governance/domains/ACCESS_CONTROL.md`, and whether any were overdue.
- Number of `CRITICAL` or `ERROR` severity authentication and authorization
  audit events recorded in the audit log, and whether unexplained spikes were
  investigated (`Governance/domains/AUDIT_LOG.md`, weekly review cadence).

### 2.4 Incident and Postmortem Metrics

- Number of security incidents opened during the period, by severity.
- Number of incidents that met the postmortem threshold, and how many
  postmortems were completed on time per
  `Governance/domains/POSTMORTEM_POLICY.md`.
- Number of confirmed data-disclosure events, if any, and the categories of
  data affected — reported without identifying affected individuals.

### 2.5 CI and Build Security Gates

- Whether the dependency security scan (§2.1) and secret/malware scanning gate
  passed on every merge during the period, or how many merges required an
  exception, and whether each exception was recorded with the required fields
  (`Governance/domains/DEPENDENCY_APPROVAL.md` §"Required security gate").
- Whether the SBOM generation CI job blocked any release during the period, and
  if so, whether the block was resolved before publishing the release.

### 2.6 Certificate and TLS Health

- Expiry status of TLS certificates managed under
  `Governance/policies/CERTIFICATE_MANAGEMENT.md` at the time of the report:
  certificates expiring within 30 days are flagged by name (not by private-key
  material).
- Number of certificate renewals or rotations completed during the period.

A metric that cannot be reported for a period is listed with an explicit
"not reported" note and the reason, rather than being omitted silently.

## 3. Report Cadence

Security posture reports are produced on a fixed, predictable schedule:

| Report | Cadence | Period covered | Published by |
| --- | --- | --- | --- |
| **Quarterly security posture report** | Every 3 months | The preceding calendar quarter | Within 30 days of the quarter's end |
| **Annual security posture report** | Every 12 months | The preceding calendar year | Within 60 days of the year's end |
| **Ad-hoc security disclosure** | As needed | The event in question | Within 14 days of the event being resolved |

Rules:

- The **quarterly** report is the baseline commitment. A quarter is never
  skipped: if a quarter's report is late, it is still published and the delay
  is noted in the report itself.
- The **annual** report consolidates the four quarterly reports and adds
  year-over-year comparisons for each metric in §2, so a reader can see the
  direction of travel, not just a snapshot.
- An **ad-hoc disclosure** is published when a confirmed data-disclosure
  incident, a high-severity vulnerability affecting a production secret or
  dependency, or a failed CI security gate goes unresolved beyond the incident
  SLA in `Governance/domains/POSTMORTEM_POLICY.md`. Ad-hoc disclosures are
  additive; they do not reset the quarterly or annual clock.
- If the project has no security activity to report for a period, the report is
  still published and states that explicitly. Silence is never used in place of
  a report.

## 4. Audience

| Audience | Delivery | Scope |
| --- | --- | --- |
| **Maintainers** | Notification via the project's internal governance channel at publication; the report is linked in the repository | Full report — all metrics in §2 |
| **Contributors** | Announcement in the repository's discussions or releases, linking the canonical document | Full report |
| **Community and downstream users** | Announcement on the project's public community channels with a link to the canonical document | Full report; no private incident detail, no unexpired embargo information |
| **Security researchers** | Linked from the project's security policy (SECURITY.md) and from the disclosure process | Full report; embargo-protected detail is excluded until the advisory is published |

Rules:

- No report or announcement names an individual affected user, contributor, or
  reporter.
- No report includes a secret value, private key material, unexpired embargo
  detail, or credential of any kind.
- If a report contains information subject to an active embargo, that section
  is withheld until the embargo lifts; the report is re-issued or amended at
  that time rather than published with a gap and no explanation.
- The maintainer who produces the report is responsible for confirming the
  delivery channels are current before publication.

## 5. Publication Location

- **Canonical location.** Every security posture report is published as a
  versioned document in the repository under `Governance/reporting/`, named
  `SECURITY_POSTURE_REPORT_<PERIOD>.md` (for example
  `SECURITY_POSTURE_REPORT_2026-Q1.md`). The repository copy is the canonical,
  citable record.
- **Announcement.** Each report is announced via the delivery channels in §4
  with a link to the canonical document.
- **Discoverability.** The list of published reports is linked from
  `Governance/README.md` so a reader can find the latest report and its
  predecessors without searching issue history.
- **Permanence.** Published reports are append-only: a report is never edited
  to change what it disclosed. A correction is issued as a new, linked document
  that references the original (see §6, Corrections).

## 6. Ownership, Review, and Corrections

- **Owner.** The maintainers own the reporting commitment. A named maintainer
  is responsible for producing each report and is recorded on the report's
  Owner line.
- **Review.** Before publication, at least one maintainer who did not author
  the report reviews it for accuracy against the underlying sources — the audit
  log, the dependency scan results, the secret rotation records, and the
  incident register — and for compliance with the privacy limits in §4.
- **Corrections.** If a published report is found to be inaccurate, a
  correction is published as a new document that references the original and
  states what changed and why. The original is left in place, consistent with
  the append-only principle in `Governance/domains/AUDIT_LOG.md`.
- **Escalation.** A dispute about a report's contents or a missed publication
  is raised as a governance issue and resolved through the normal governance
  process in `Governance/README.md`.

## 7. Regression Tests

This document is a governance-only, documentation-only change. It introduces no
runtime behaviour, no schema change, and no executable code. Accordingly, it
adds no tests and requires none. The existing lint, typecheck, build, and test
suites must continue to pass, as verified by the `validate` job in
`.github/workflows/ci.yml` described in `CONTRIBUTING.md`.

When a future code change touches a control area referenced by this report —
secret rotation, access-grant recording, the CI security gate, SBOM generation,
or certificate management — that change ships with tests that enforce the
relevant policy, including:

- **Rotation compliance** — unit test that
  `SecretsManagerService.rotateCriticalSecrets()` records a success event and
  that a failed run is surfaced as an alertable error, per
  `Governance/domains/SECRETS_MANAGEMENT.md` §4 and
  `Governance/domains/CRON_GOVERNANCE.md`.
- **Audit coverage** — coverage in `src/audit-log/` that authentication and
  authorisation events are recorded for paths that this report monitors, per
  `Governance/domains/AUDIT_LOG.md`.
- **CI gate integrity** — no merge path exists that skips the dependency
  security scan or the SBOM generation job, per
  `Governance/domains/DEPENDENCY_APPROVAL.md` §"Required security gate" and
  `Governance/domains/SBOM_POLICY.md` §"Regression Tests".
- **No secret in output** — sensitive keys remain redacted in logs and API
  responses, per `src/logging/sensitive-data.masker.spec.ts` and
  `src/security/audit/security-event-logger.spec.ts`.

## 8. Relationship to Other Governance Documents

- `Governance/policies/TRANSPARENCY_REPORTS.md` — the broader community
  transparency report; §3.2 of that policy overlaps with §2.4 of this one.
  Where both documents require a metric to be reported, this document is the
  authoritative source for security-specific detail.
- `Governance/policies/PUBLIC_METRICS.md` — governs the Prometheus scrape
  surface; `securityEventsTotal` is internal-only per that policy and is
  reported here in aggregate, not via the scrape endpoint.
- `Governance/domains/AUDIT_LOG.md` — the source of record for the events
  counted in §2.3 and §2.4.
- `Governance/domains/SECRETS_MANAGEMENT.md` — rotation intervals and triggers
  reported in §2.2.
- `Governance/domains/DEPENDENCY_APPROVAL.md` — the dependency review and
  security gate metrics reported in §2.1 and §2.5.
- `Governance/domains/SBOM_POLICY.md` — the SBOM generation status reported in
  §2.1 and §2.5.
- `Governance/domains/POSTMORTEM_POLICY.md` — which incidents require a
  postmortem, counted in §2.4.
- `Governance/policies/CERTIFICATE_MANAGEMENT.md` — the certificate expiry
  tracking reported in §2.6.
- `Governance/domains/ACCESS_CONTROL.md` — the access review cadence and grant
  or revocation counts reported in §2.3.

Where this document and another governance document conflict, the more specific
document prevails for its subject matter, and the conflict is recorded as a
governance issue.

## 9. Change Log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-01-01 | Initial security posture report document (metrics, cadence, audience, publication location, regression test guidance). |
