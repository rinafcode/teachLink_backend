# Transparency Report Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-01-01
- **Review cadence:** Every 6 months, or after any change to the metrics or
  publication channels it references

This document defines how TeachLink Backend publishes **transparency reports**:
how often they are produced, which metrics they disclose, and where they are
published. It exists so that the community, contributors, and downstream users
have a predictable, versioned account of how the project is run and how it
handles the data and decisions entrusted to it.

This policy is part of the project's **Community & on-chain governance** and
**Security & disclosure** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## 1. Scope

This policy applies to the project's public transparency reporting. It covers:

- The **cadence** at which reports are produced and published (§2).
- The **metrics** each report discloses (§3).
- The **publication channels** and the canonical location of each report (§4).
- The **ownership, review, and correction** rules for a published report (§5).

It does not govern internal operational reporting, incident postmortems
(`Governance/domains/POSTMORTEM_POLICY.md`), or the audit log itself
(`Governance/domains/AUDIT_LOG.md`); those documents remain authoritative for
their subject matter. Where a metric here is derived from an audited source,
the source document prevails.

## 2. Report Cadence

Transparency reports are produced on a fixed, predictable schedule:

| Report | Cadence | Period covered | Published by |
| --- | --- | --- | --- |
| **Quarterly transparency report** | Every 3 months | The preceding calendar quarter | Within 30 days of the quarter's end |
| **Annual transparency report** | Every 12 months | The preceding calendar year | Within 60 days of the year's end |
| **Ad-hoc disclosure** | As needed | The event in question | Within 30 days of the event being resolved |

Rules:

- The **quarterly** report is the baseline commitment. A quarter is never
  skipped: if a quarter's report is late, it is still published, and the delay
  is noted in the report itself.
- The **annual** report consolidates the four quarterly reports for the year
  and adds the year-over-year comparison required by §3.6. It does not replace
  the quarterly reports.
- An **ad-hoc disclosure** is published when an event materially affects the
  metrics in §3 — for example a confirmed data-disclosure incident, a
  significant governance change, or a change to the reporting itself. Ad-hoc
  disclosures are additive; they do not reset the quarterly or annual clock.
- If the project has no activity to report for a period, the report is still
  published and states that explicitly. Silence is never used in place of a
  report.

## 3. Metrics Disclosed

Each report discloses the metrics below for the period it covers. Metrics are
reported as aggregate counts or rates; no individual user, contributor, or
reporter is identified.

### 3.1 Governance activity

- Number of governance proposals opened, merged, and rejected.
- Number of formal votes held, and the outcome of each
  (`Governance/processes/FORMAL_VOTING.md`).
- Number of role changes: new maintainers, reviewers, triagers, and emeritus
  transitions (`Governance/policies/INACTIVITY.md`).
- Number of privilege revocations and the ground(s) relied on, at the category
  level only (`Governance/policies/REVOCATION.md` §1).

### 3.2 Security and disclosure

- Number of vulnerability reports received, and how many were triaged,
  remediated, and disclosed.
- Number of security advisories published.
- Number of incidents meeting the postmortem threshold
  (`Governance/domains/POSTMORTEM_POLICY.md`), by severity, and how many
  postmortems were completed.
- Number of data-disclosure events, if any, and the categories of data
  affected — reported without identifying affected individuals.

### 3.3 Community and conduct

- Number of Code of Conduct reports received and the number resolved, at the
  category level only. Individual cases, parties, and outcomes are never
  disclosed.
- Number of active contributors, reviewers, and maintainers at the end of the
  period.

### 3.4 Contribution and release activity

- Number of issues opened and closed, and pull requests opened, merged, and
  closed without merge.
- Number of releases published, and the number of breaking changes shipped
  (see the releases & change governance documents).

### 3.5 Data and privacy

- Number of data-subject requests received (access, correction, deletion) and
  the number fulfilled within the applicable window.
- Number of third-party integrations added or removed
  (`Governance/domains/THIRD_PARTY_INTEGRATION.md`).

### 3.6 Trends

- The annual report includes a year-over-year comparison for each metric in
  §3.1–§3.5, so a reader can see direction of travel, not just a snapshot.

A metric that cannot be reported for a period is listed with an explicit
"not reported" note and the reason, rather than being omitted silently.

## 4. Where Reports Are Published

- **Canonical location.** Every transparency report is published as a
  versioned document in the repository under `Governance/reports/`, named
  `TRANSPARENCY_REPORT_<PERIOD>.md` (for example
  `TRANSPARENCY_REPORT_2026-Q1.md`). The repository copy is the canonical,
  citable record.
- **Announcement.** Each report is announced on the project's public
  communication channels (the repository's releases/discussions and the
  project's community channel) with a link to the canonical document.
- **Discoverability.** The list of published reports is linked from
  `Governance/README.md` so a reader can find the latest report and its
  predecessors without searching issue history.
- **Permanence.** Published reports are append-only: a report is never edited
  to change what it disclosed. A correction is issued as a new, linked
  document that references the original (see §5).

## 5. Ownership, Review, and Corrections

- **Owner.** The maintainers own the reporting commitment. A named maintainer
  is responsible for producing each report and is recorded on the report's
  Owner line.
- **Review.** Before publication, at least one maintainer who did not author
  the report reviews it for accuracy against the underlying sources and for
  compliance with the privacy limits in §3.
- **Corrections.** If a published report is found to be inaccurate, a
  correction is published as a new document that references the original and
  states what changed and why. The original is left in place, matching the
  append-only principle used for the audit log
  (`Governance/domains/AUDIT_LOG.md`).
- **Escalation.** A dispute about a report's contents or a missed publication
  is raised as a governance issue and resolved through the normal governance
  process described in `Governance/README.md`.

## 6. Relationship to Other Governance Documents

- `Governance/domains/AUDIT_LOG.md` — the source of record for audited events
  that feed §3.2.
- `Governance/domains/POSTMORTEM_POLICY.md` — defines which incidents require a
  postmortem, which §3.2 counts.
- `Governance/policies/REVOCATION.md` — defines the revocation grounds
  summarised in §3.1.
- `Governance/domains/THIRD_PARTY_INTEGRATION.md` — defines the integrations
  counted in §3.5.

Where this policy and another governance document conflict, the more specific
document prevails for its subject matter, and the conflict is recorded as a
governance issue.

## 7. Review

This policy is reviewed at least once a year, or whenever the metrics in §3 or
the publication channels in §4 change. Changes are proposed through the normal
governance process described in `Governance/README.md` and must touch only the
`Governance/` folder.

## 8. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-01-01 | Initial transparency report policy (cadence, metrics, publication channels). |
