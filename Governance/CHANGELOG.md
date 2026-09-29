# Governance Changelog

All notable changes to governance documents are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- `Governance/SECURITY_SEVERITY_RUBRIC.md` — severity levels, criteria per level, and response SLA per level (issue #1617)
- `Governance/policies/LICENSING.md` — project licensing framework, inbound-equals-outbound rule, and license change procedures
- `Governance/policies/GOOD_FIRST_ISSUE.md` — criteria for the `good first issue` label, who may apply it, and mentorship expectations (issue #1610)
- `Governance/processes/VULN_DISCLOSURE.md` — private reporting channels, triage steps, and coordinated-disclosure timeline (issue #1612)
- `Governance/processes/COORDINATED_DISCLOSURE.md` — reporter coordination, public-disclosure timing, and credit policy (issue #1616)
- `Governance/SECURITY_RESPONSE_TEAM.md` — security response team membership, responsibilities, and on-call rotation (issue #1614)
- `Governance/SECURITY_POLICY.md` — supported versions, private vulnerability reporting channels, and response-time commitments (issue #1611)
- `Governance/templates/ADVISORY_TEMPLATE.md` — security advisory sections including severity, CVSS, and remediation fields (issue #1615)
- `Governance/policies/EMBARGO.md` — default embargo durations by severity, embargo list membership, and early-disclosure exceptions (issue #1613)
- `Governance/policies/DCO.md` — Developer Certificate of Origin sign-off requirement, verification, and remediation (issue #1609)


## [1.0.0] – 2026-09-27

### Added

- `Governance/domains/DATA_RETENTION.md` — initial data-retention policy covering:
  - Retention periods for all data types (users, courses, payments, audit logs, notifications, analytics, messages, media, sessions, consent records, backups)
  - Automated and manual deletion processes, including GD@R Article 17 right-to-erasure and CCPA §798.105 right-to-delete flows
  - Legal-hold exceptions: how to place, verify, lift, and handle emergency preservation
  - Compliance mapping to GDPR, CCPA, and SOX requirements
  - Roles and responsibilities
  - Links to the runtime implementation (`src/config/retention.config.ts`, `src/data-retention/`)
