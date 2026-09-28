# Governance Changelog

All notable changes to governance documents are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [1.0.0] – 2026-09-27

### Added

- `Governance/domains/DATA_RETENTION.md` — initial data-retention policy covering:
  - Retention periods for all data types (users, courses, payments, audit logs, notifications, analytics, messages, media, sessions, consent records, backups)
  - Automated and manual deletion processes, including GDPR Article 17 right-to-erasure and CCPA §1798.105 right-to-delete flows
  - Legal-hold exceptions: how to place, verify, lift, and handle emergency preservation
  - Compliance mapping to GDPR, CCPA, and SOX requirements
  - Roles and responsibilities
  - Links to the runtime implementation (`src/config/retention.config.ts`, `src/data-retention/`)
