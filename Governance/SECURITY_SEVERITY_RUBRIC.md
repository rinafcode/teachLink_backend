# Security Severity Rubric

All security vulnerabilities reported against TeachLink Backend are assigned a severity level using the rubric below. This document is the authoritative, versioned reference for severity classification and response SLAs. It complements `Governance/SECURITY_POLICY.md`, `Governance/processes/VULN_DISCLOSURE.md`, and `Governance/policies/EMBARGO.md`.

---

## 1. Severity Levels

TeachLink uses four severity levels. Each level is defined by the impact of exploitation on confidentiality, integrity, and availability (CIA) of the TeachLink Backend and its users.

| Level | Name | Definition |
|-------|------|------------|
| P0 | Critical | Exploitation is trivial or already occurring, and leads to widespread compromise of user data, funds, or service integrity. |
| P1 | High | Exploitation is realistic and leads to significant loss of confidentiality, integrity, or availability for a substantial set of users or a core service. |
| P2 | Medium | Exploitation requires specific conditions or privileges and leads to limited impact on confidentiality, integrity, or availability. |
| P3 | Low | Exploitation is difficult, requires significant preconditions, or results in minimal or no measurable impact. |

---

## 2. Criteria per Level

The following criteria are used to assign a severity level. At least one criterion from a level must be met to assign that level. When multiple levels apply, the highest applicable level is assigned.

### P0 — Critical

- Remote unauthenticated code execution on production infrastructure.
- Authentication bypass affecting all users or administrator accounts.
- Exposure of signing keys, secrets, or database credentials used in production.
- Mass extraction or corruption of user personal data, payment data, or course content.
- Payment or ledger manipulation resulting in financial loss or double-spending.
- Denial of service that fully disrupts the platform with no workaround.

### P1 — High

- Authenticated code execution or privilege escalation within a tenant or service.
- Authorization flaw allowing access to another user's data or administrative functions.
- SQLi or noSQL injection with measurable impact on data integrity or confidentiality.
- Stored cross-site scripting (XSS) or cross-site request forgery (CSRF) with session or account impact.
- Exposure of a limited set of credentials or personal data not intended for public consumption.
- Sustained denial of service against a core service with a partial workaround.

### P2 — Medium

- Exploitation requiring an authenticated account with non-default privileges.
- Information disclosure of low-sensitivity metadata or internal system details.
- Integrity issues that require a specific configuration or user interaction to trigger.
- Business logic flaws with limited financial or operational impact.
- Denial of service against a non-core service or with a workaround.
- Missing security headers or weak cryptographic parameters with a demonstrable but limited exploit path.

### P3 — Low

- Information disclosure with no security impact or only publicly available information.
- Theoretical issues requiring attacker control of the client, network, or server already compromised.
- Best-practice deviations with no demonstrable exploit path.
- Denial of service against a single non-critical endpoint with negligible user impact.
- Issues already mitigated by existing controls or defense-in-depth measures.

---

## 3. Response SLA per Level

SLAs are measured from the moment a report is received by the Security Response Team (see `Governance/SECURITY_RESPONSE_TEAM.md`). All times are in calendar hours and refer to acknowledgement, triage, and remediation targets.

| Level | Acknowledgement | Triage | Mitigation | Permanent Fix | Public Disclosure |
|-------|---------------|-------|------------|---------------|------------------|
| P0 | <= 2 hours | <= 4 hours | <= 24 hours | <= 72 hours | <= 7 days |
| P1 | <= 8 hours | <= 24 hours | <= 72 hours | <= 14 days | <= 30 days |
| P2 | <= 2 business days | <= 5 business days | <= 14 days | <= 45 days | <= 90 days |
| P3 | <= 5 business days | <= 10 business days | Not required | Next regular release | <= 180 days |

### SLA notes

- Acknowledgement means the reporter receives a confirmation that the report was received and is being triaged.
- Triage means a severity level is assigned and the reporter is informed of the classification.
- Mitigation means a workaround, hotfix, or configuration change is deployed to reduce exploitability.
- Permanent fix means the root cause is remediated and verified in the main branch.
- Public disclosure is governed by `Governance/processes/COORDINATED_DISCLOSURE.md` and `Governance/policies/EMBARGO.md`.
- Slas may be extended by the Security Response Team when a fix requires dependency upgrades, external coordination, or upgrade windows. Extensions must be documented in the advisory or triage record.

---

## 4. Assignment and Review

- Severity is initially assigned by the Security Response Team during triage.
- Severity may be re-assigned as technical details emerge; the reporter is notified of any change.
- Any change to this rubric requires a governance review and a changelog entry in `Governance/CHANGELOG.md`.

---

## 5. References

- `Governance/SECURITY_POLICY.md` — supported versions and reporting channels.
- `Governance/SECURITY_RESPONSE_TEAM.md` — team membership and on-call rotation.
- `Governance/processes/VULN_DISCLOSURE.md` — private reporting and triage steps.
- `Governance/processes/COORDINATED_DISCLOSURE.md` — coordinated disclosure timing.
- `Governance/policies/EMBARGO.md` — default embargo durations by severity.
- `Governance/templates/ADVISORY_TEMPLATE.md` — security advisory format.
