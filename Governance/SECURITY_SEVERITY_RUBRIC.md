# Security Severity Rubric

All security issues reported against TeachLink Backend are assigned a severity level using the rubric below. The rubric is the authoritative reference for triage, remediation prioritization, and disclosure timing. It is versioned and maintained by the Security Response Team (See `Governance/SECURITY_RESPONSE_TEAM.md`).

This document is normative. Where it conflicts with any other governance document, this rubric takes precedence for severity classification and response SLAs.

---

## 1. Severity Levels

A severity level is assigned based on the combined impact of **exploitability** and **business/data impact**. When a finding spans multiple levels, the highest applicable level is assigned.

| Level | Label | Description |
| --- | --- | --- |
| S0 | Critical | Exploitable with minimal effort, with direct impact on funds, identity, or system integrity at scale. |
| S1 | High | Exploitable with moderate effort or specific pre-texts, with serious impact on a subset of users or systems. |
| S2 | Medium | Exploitable with significant effort or uncommon conditions, with limited impact. |
| S3 | Low | Hard to exploit or impact is minimal; defense-in-depth or hardening only. |

---

## 2. Criteria per Level

### S0 — Critical

A finding is S0 if **any** of the following hold:

- Remote code execution or command injection in a production path without authentication or with a low-privilege account.
- Authentication bypass or full account takeover (e.g., JWT signing key leak, session fixation, password reset token predictability).
- Direct access to or exfiltration of secrets, credentials, or private keys used in production.
- Integrity compromise of financial or payment flows (e.g., arbitrary transfer amounts, double-spend, prize manipulation).
- Sql injection or deserialization vector leading to database read/write or RCE.
- Breach of tenant isolation exposing other organizations' data at scale.

### S1 — High

A finding is S1 if **any** of the following hold and no S0 criteria are met:

- Privilege escalation from a normal user to administrator or system role.
- Authenticated remote code execution or command injection.
- Stored CRSS or XSS in a privileged context (e.g., admin dashboard) affecting other users.
- Unauthorized read or write of another user's private data (PII, messages, course assignments) without an exploit chain.
- Bypass of authorization controls (IDBOR, forced browsing) on sensitive resources.
- Denial of service that fully takes down a production service with a single request or small burst.
- Supply-chain compromise of a build or deployment pipeline.

### S2 — Medium

A finding is S2 if **any** of the following hold and no S0/S1 criteria are met:

- Reflected CRSS/XSS in a non-privileged context requiring user interaction.
- Information disclosure of low-sensitivity metadata (e.g., username enumeration, email existence).
- Authenticated denial of service affecting a single tenant or service with moderate effort.
- Missing or weak cryptography for at-rest data with a realistic attack path.
- CSRF or state-changing GET on a sensitive endpoint without additional conditions.
- Logic flaws in business rules with limited financial impact (e.g., incorrect discount application).
- Partial bypass of rate limiting or abuse prevention controls.

### S3 — Low

A finding is S3 if **all** of the following hold:

- Impact is limited to defense-in-depth hardening or informational findings.
- Exploitation requires privileged access, rare conditions, or significant user interaction.
- No direct confidentiality, integrity, or availability impact in production.
- Examples: missing security headers, verbose error messages without sensitive data, dependency vulnerability with no reachable path, debug endpoints not reachable in production.

---

## 3. Response SLA per Level

SLAs are measured from the time the report is received by the Security Response Team via a private channel defined in `Governance/SECURITY_POLICY.md`. All SLAs are calendar-time commitments.

| Level | Acknowledge | Triage | Fix deployed | Public advisory |
| --- | --- | --- | --- | --- |
| S0 | 4 hours | 24 hours | 72 hours | 7 days after fix |
| S1 | 24 hours | 3 business days | 14 days | 30 days after fix |
| S2 | 3 business days | 7 business days | 45 days | 90 days after fix |
| S3 | 5 business days | 10 business days | Next release cycle | Not required |

Notes:

- **Acknowledge** means the reporter receives a response confirming receipt and a tracking identifier.
- **Triage** means a severity level is assigned and an initial impact assessment is shared with the reporter.
- **Fix deployed** means the remediation is merged and released to all affected supported versions.
- **Public advisory** is published per `Governance/processes/COORDINATED_DISCLOSURE.md`.
- Embargo durations follow `Governance/policies/EMBARGO.md` and are derived from the assigned severity level.
- Supported versions are defined in `Governance/SECURITY_POLICY.md`.

---

## 4. Severity Assignment Process

1. The Security Response Team traiges the report and assigns a preliminary severity level using the criteria in Section 2.
2. The assigned level determines the SLA in Section 3 and the embargo duration in `Governance/policies/EMBARGO.md`.
3. Severity may be re-assigned if new information changes the impact or exploitability assessment. Re-assignment must be recorded in the internal tracking issue and communicated to the reporter.
4. If the reporter disagrees with the assigned severity, they may request a review by the Security Response Team lead. The lead's decision is final and documented.

---

## 5. Versioning

This rubric is versioned. Material changes to criteria or SLAs require a minor version bump and a changelog entry in `Governance/CHANGELOG.md`. Clarifications that do not change meaning may be made without a version bump but must still be recorded.

| Rubric version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-27 | Initial rubric: severity levels, criteria, and response SLAs. |

---

## 6. Related Documents

- `Governance/SECURITY_POLICY.md` — supported versions and private reporting channels.
- `Governance/SECURITY_RESPONSE_TEAM.md` — triage ownership and on-call rotation.
- `Governance/processes/VULN_DISCLOSURE.md` — private reporting and triage steps.
- `Governance/processes/COORDINATED_DISCLOSURE.md` — disclosure timing and credit.
- `Governance/policies/EMBARGO.md` — embargo durations by severity.
- `Governance/templates/ADVISORY_TEMPLATE.md` — advisory format including severity and CVSS.
