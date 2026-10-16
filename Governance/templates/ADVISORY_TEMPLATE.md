# Security Advisory Template

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or when the disclosure process changes

This is the template every public security advisory for TeachLink Backend
starts from. It defines the required sections, severity and CVSS fields, and
remediation guidance so advisories stay consistent and actionable.

This document is part of the project’s **Security & disclosure** area. It
lives entirely inside the `Governance/` folder and does not change
application code. Usage is governed by
[`SECURITY_POLICY.md`](../SECURITY_POLICY.md) and
[`policies/EMBARGO.md`](../policies/EMBARGO.md).

## How To Use This Template

1. Copy the **Template** section below into a new advisory draft (GitHub
   Security Advisory, or `Governance/advisories/TLSA-YYYY-NNNN.md` if the
   project publishes mirrored markdown).
2. Fill every section. Mark unknown fields as `TBD` until embargo ends.
3. Do not publish until the embargo policy allows disclosure.

---

## Template

```markdown
# TLSA-YYYY-NNNN: <Short title>

- **Advisory ID:** TLSA-YYYY-NNNN
- **Published:** <YYYY-MM-DD or "Embargoed">
- **Updated:** <YYYY-MM-DD>
- **Reporter(s):** <name or "Anonymous" / handle>
- **Credit:** <optional public credit line>

## Summary

One or two sentences describing the vulnerability and who is affected.

## Affected Products and Versions

| Product | Affected versions | Fixed versions |
|---------|-------------------|----------------|
| TeachLink Backend | <e.g. >=1.2.0 <1.2.5> | <e.g. 1.2.5, 1.3.0> |

## Severity

- **Severity rating:** Critical | High | Medium | Low | None
- **CVSS version:** 3.1
- **CVSS vector string:** e.g. `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`
- **CVSS base score:** e.g. `9.8`

Brief justification for the score (attack vector, privileges required,
user interaction, impact on confidentiality/integrity/availability).

## Technical Description

What the vulnerability is, without unnecessary exploit detail during
embargo. After public release, include enough detail for operators to
assess exposure.

## Impact

What an attacker can achieve if the issue is exploited (data access,
account takeover, denial of service, etc.).

## Remediation

**Required field.** Clear operator guidance, for example:

- Upgrade to version `<fixed>` or later
- If upgrade is not immediately possible, apply temporary mitigations:
  - <configuration change, WAF rule, feature flag, etc.>
- Verify the fix: <smoke test or check>

## Workarounds

Optional. Temporary measures that reduce risk without a full upgrade.

## References

- Pull request / commit fixing the issue
- Upstream CVE (if assigned): CVE-YYYY-NNNNN
- Related RFCs or ADRs

## Timeline (optional)

| Date | Event |
|------|--------|
| YYYY-MM-DD | Report received |
| YYYY-MM-DD | Fix merged |
| YYYY-MM-DD | Advisory published |
```

## Field Notes

- **Severity and CVSS** must both be present for public advisories; if a
  formal CVSS score is pending, state severity qualitatively and mark the
  vector `TBD`.
- **Remediation** must never be empty for a published advisory: operators
  need a concrete action.
- Do not embed secrets, private customer data, or full unredacted exploit
  chains in the public advisory.

## Document History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial advisory template (issue #1615) |
