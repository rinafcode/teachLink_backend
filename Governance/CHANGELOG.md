# Governance Changelog

All notable changes to governance documents are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- `Governance/SECURITY_POLICY.md` — supported versions, private vulnerability reporting channels, and response-time commitments (issue #1611)
- `Governance/templates/ADVISORY_TEMPLATE.md` — security advisory sections including severity, CVSS, and remediation fields (issue #1615)
- `Governance/policies/EMBARGO.md` — default embargo durations by severity, embargo list membership, and early-disclosure exceptions (issue #1613)
- `Governance/policies/DCO.md` — Developer Certificate of Origin sign-off requirement, verification, and remediation (issue #1609)


## [1.0.0] – 2026-09-27

### Added

- `Governance/domains/DATA_RETENTION.md` — initial data-retention policy covering:
  - Retention periods for all data types (users, courses, payments, audit logs, notifications, analytics, messages, media, sessions, consent records, backups)
  - Automated and manual deletion processes, including GDPR Article 17 right-to-erasure and CCPA §1798.105 right-to-delete flows
  - Legal-hold exceptions: how to place, verify, lift, and handle emergency preservation
  - Compliance mapping to GDPR, CCPA, and SOX requirements
  - Roles and responsibilities
  - Links to the runtime implementation (`src/config/retention.config.ts`, `src/data-retention/`)
