# Security Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](README.md#structure))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or after any material change to the disclosure or response process

This policy defines which versions of TeachLink Backend receive security
updates, how to report a vulnerability, and what response commitments the
project makes to reporters. It lives entirely inside the `Governance/` folder
and does not change application code.

Related documents:

- Embargo handling: [`policies/EMBARGO.md`](policies/EMBARGO.md)
- Public advisory shape: [`templates/ADVISORY_TEMPLATE.md`](templates/ADVISORY_TEMPLATE.md)

## 1. Supported Versions

Security fixes are published only for the versions listed below as
**Supported**. Versions marked **Unsupported** no longer receive patches;
upgrading to a supported line is required.

| Version line | Status | Notes |
|--------------|--------|-------|
| `main` (unreleased) | Supported | Continuous integration; fixes land here first |
| Latest stable release (`x.y.z`) | Supported | Current production line |
| Previous minor (`x.(y-1).z`) | Supported | Security fixes only, for at least 90 days after the next minor ships |
| Older minors / major lines | Unsupported | No security updates |

Exact release tags are published on the repository Releases page. If a
supported line is nearing end-of-life, maintainers will announce the date in
the Governance changelog and in release notes at least 30 days in advance.

## 2. Reporting a Vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Report privately using one of the following channels (in preferred order):

1. **GitHub Security Advisories** — use *Report a vulnerability* on this
   repository (private report to maintainers).
2. **Email** — `security@teachlink.example` (replace with the project’s
   published security contact if different), with subject line
   `[SECURITY] short description`.

Include, where possible:

- Affected version(s) and deployment context (self-hosted, managed, etc.)
- Steps to reproduce or a proof-of-concept
- Impact assessment (confidentiality, integrity, availability)
- Whether you are able to assist with testing a fix

Encrypt sensitive attachments if you have the project’s published PGP key;
otherwise send a minimal description and arrange a secure channel.

## 3. Response Commitment

| Stage | Target |
|-------|--------|
| Acknowledgement of a private report | Within **3 business days** |
| Initial severity triage | Within **7 calendar days** of acknowledgement |
| Status update to reporter | At least every **14 calendar days** until resolution |
| Fix or mitigation on a supported version | As soon as practicable; critical issues prioritized over features |

Severity is assessed using CVSS v3.1 (or the version named in the advisory
template). Public disclosure follows the embargo policy in
[`policies/EMBARGO.md`](policies/EMBARGO.md). Coordinated disclosure is the
default: reporters are asked not to publish details until a fix is available
or the embargo ends.

Maintainers may decline a report (with explanation) if it is out of scope
(e.g. social engineering of end users, denial-of-service against
third-party infrastructure, or issues only present on unsupported versions).

## 4. Safe Harbor

Good-faith security research conducted under this policy will not be treated
as a violation of the project’s contribution guidelines, provided the
researcher:

- Avoids privacy violations, destruction of data, and disruption of
  production services beyond what is necessary to demonstrate the issue
- Does not exploit a vulnerability beyond the proof needed for the report
- Does not access or modify data that is not their own without permission

## 5. Document History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial security policy (issue #1611) |
