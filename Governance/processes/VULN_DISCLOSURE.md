# Vulnerability Disclosure Process

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Security Response Team (see [`SECURITY_RESPONSE_TEAM.md`](../SECURITY_RESPONSE_TEAM.md))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or after any change to reporting channels

This process describes how vulnerabilities in TeachLink Backend are reported
privately, triaged, and handled through coordinated disclosure. It lives
entirely inside the `Governance/` folder and does not change application code.

Related documents:

- [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) — supported versions and response commitments  
- [`COORDINATED_DISCLOSURE.md`](COORDINATED_DISCLOSURE.md) — public timing and credit  
- [`policies/EMBARGO.md`](../policies/EMBARGO.md) — embargo durations  
- [`templates/ADVISORY_TEMPLATE.md`](../templates/ADVISORY_TEMPLATE.md)

## 1. Private Reporting Channel

**Do not** file public GitHub issues for security vulnerabilities.

Use one of the following private channels (preferred order):

1. **GitHub Security Advisories** — *Report a vulnerability* on this repository
   (visible only to maintainers with security access).
2. **Email** — `security@teachlink.example` (or the address published in
   `SECURITY_POLICY.md` if updated), subject prefix `[SECURITY]`.

Reports should include, when available:

- Product / component and affected version(s)
- Reproduction steps or proof-of-concept
- Impact (confidentiality, integrity, availability)
- Whether the issue is already public or actively exploited
- Preferred contact method and any disclosure constraints

## 2. Triage Steps

Upon receipt of a private report, the Security Response Team (or on-call
security maintainer) will:

| Step | Action | Target |
|------|--------|--------|
| 1 | **Acknowledge** the reporter | Within **3 business days** |
| 2 | **Validate** reproducibility and affected versions | As soon as practical after acknowledgement |
| 3 | **Severity triage** (Critical / High / Medium / Low) | Using impact and exploitability; CVSS optional but preferred for High+ |
| 4 | **Assign owner** | A maintainer responsible for the fix path |
| 5 | **Open private tracking** | GitHub Security Advisory draft or private issue; not a public bug ticket |
| 6 | **Notify embargo list** as needed | Per `policies/EMBARGO.md` |
| 7 | **Plan fix and advisory** | Track against supported version lines in `SECURITY_POLICY.md` |

If the report is out of scope (e.g. social engineering of end users, or a
third-party service outside this repository), respond with a brief explanation
and, where possible, a pointer to the correct vendor.

Duplicate reports are linked to the existing private case; later reporters may
still receive credit per the coordinated disclosure policy when appropriate.

## 3. Coordinated-Disclosure Timeline

Default timeline from **acknowledgement**:

| Phase | Target |
|-------|--------|
| Initial assessment | ≤ 7 days |
| Fix development for supported lines | Severity-driven; align with embargo maxima in `EMBARGO.md` |
| Pre-disclosure notice to reporter | ≥ 3 days before public advisory when practical |
| Public advisory + release notes | When fix is available **or** embargo maximum is reached (see `COORDINATED_DISCLOSURE.md`) |

Active exploitation or public leak may compress this timeline; the team documents
deviations in the private advisory notes.

## 4. Reporter Expectations

Reporters are asked to:

- Keep technical details confidential until the embargo ends or maintainers agree
  to earlier disclosure
- Avoid accessing other users’ data beyond the minimum needed to demonstrate impact
- Not degrade production availability as part of testing

The project will not pursue legal action against good-faith research that
follows this process and applicable law.

## 5. Change History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial vulnerability disclosure process (issue #1612) |
