# Coordinated Disclosure Process

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Security Response Team (see [`SECURITY_RESPONSE_TEAM.md`](../SECURITY_RESPONSE_TEAM.md))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or after advisory process changes

This process defines how TeachLink Backend coordinates with vulnerability
reporters before public disclosure, when information becomes public, and how
credit is assigned. It lives entirely inside the `Governance/` folder and does
not change application code.

Related documents:

- [`VULN_DISCLOSURE.md`](VULN_DISCLOSURE.md) — private reporting and triage  
- [`policies/EMBARGO.md`](../policies/EMBARGO.md) — embargo duration and list  
- [`templates/ADVISORY_TEMPLATE.md`](../templates/ADVISORY_TEMPLATE.md)  
- [`SECURITY_POLICY.md`](../SECURITY_POLICY.md)

## 1. Coordination Steps with Reporters

After triage (see `VULN_DISCLOSURE.md`), the assigned security owner will:

1. **Confirm shared understanding** — impact, affected versions, and whether a
   public write-up by the reporter is planned.
2. **Agree a working timeline** — target fix windows within the severity-based
   embargo maxima; document any mutually agreed shorter or longer period.
3. **Share status updates** — at least when severity changes, when a fix is
   merged to a supported line, and when public disclosure is scheduled.
4. **Exchange draft advisory text** — invite reporter feedback on technical
   accuracy (not a veto on whether to disclose after embargo rules are met).
5. **Confirm credit line** — how the reporter wishes to be named (name, handle,
   team, or anonymous).

Coordination happens on the private channel used for the original report
(GitHub Security Advisory discussion or email thread).

## 2. Public-Disclosure Timing

Public disclosure (GitHub Security Advisory publication, release notes, and any
CVE request) occurs when **either**:

- A fix is available for all **supported** version lines that are materially
  affected, **and** the Security Response Team is ready to publish; or  
- The applicable **embargo maximum** in `policies/EMBARGO.md` is reached,

whichever comes first, unless an exception in the embargo policy applies
(e.g. issue already fully public).

**Prefer** disclosing with a fixed release. When disclosing without a complete
fix (embargo expiry or active exploitation), the advisory must state residual
risk and mitigations clearly.

Pre-announcement to the embargo list may occur shortly before publication so
downstream operators can prepare; it is not a substitute for the public
advisory.

## 3. Credit Policy

| Situation | Credit practice |
|-----------|-----------------|
| Valid, in-scope report leading to a fix or advisory | Named in the advisory “Credits” section per reporter preference |
| Duplicate of an already-tracked private issue | Optional “additional reporters” credit if they added material new information |
| Out-of-scope or invalid | No public credit; polite private explanation |
| Reporter requests anonymity | Honor anonymity in all public materials |
| Reporter declines credit | Omit name; internal notes may retain contact for follow-up |

Credit does not imply employment by or endorsement of TeachLink. CVE assignment,
when pursued, follows the same credit preferences where the issuing CNA allows.

Maintainers who discover issues internally are credited as “TeachLink
maintainers” or by name at their option; internal finds still follow embargo
and advisory quality standards.

## 4. Disputes

Disagreements about severity, timing, or credit are escalated to the Security
Response Team lead (see charter). The project’s final call on publication timing
follows this process and the embargo policy after good-faith consultation with
the reporter.

## 5. Change History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial coordinated disclosure process (issue #1616) |
