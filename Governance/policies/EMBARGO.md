# Embargo Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or after any change to disclosure partners

This policy defines how long security issues remain under embargo before
public disclosure, who may receive embargoed information, and when early
disclosure is allowed. It lives entirely inside the `Governance/` folder and
does not change application code.

Related documents:

- [`SECURITY_POLICY.md`](../SECURITY_POLICY.md)
- [`templates/ADVISORY_TEMPLATE.md`](../templates/ADVISORY_TEMPLATE.md)

## 1. Default Embargo Duration

| Severity (per security policy triage) | Default embargo |
|---------------------------------------|-----------------|
| Critical | Up to **90 days** from maintainer acknowledgement |
| High | Up to **60 days** |
| Medium | Up to **45 days** |
| Low | Up to **30 days** |

The embargo **ends early** when:

- A fixed release is available for all supported version lines that are
  materially affected, **and**
- Maintainers have published (or scheduled) the advisory,

or when the maximum duration above is reached—whichever comes first.

Maintainers may shorten the embargo (for example when the issue is already
public or trivial to fix). Extending beyond the defaults requires documented
agreement with the reporter and a brief note in the Governance decision log.

## 2. Embargo List (Who May Receive Details)

Embargoed technical details may be shared only with:

1. **Core maintainers** with repository security-advisory access  
2. **The original reporter** (and their designated co-reporters)  
3. **Downstream distributors or hosting partners** listed on the current
   embargo distribution list (maintained by the security owners; not
   published in full when that would increase risk)  
4. **Service providers** strictly necessary to develop or test a fix (under
   NDA or equivalent contractual confidentiality)

Everyone on the embargo list must agree not to disclose root cause, exploit
technique, or unpatched exposure publicly until the embargo lifts.

The embargo list is **not** a public CC list for all contributors. General
contributors and the wider community receive information through the
published advisory after the embargo ends.

## 3. Early-Disclosure Exceptions

Public disclosure before the default embargo ends is permitted when **any**
of the following hold:

| Exception | Condition |
|-----------|-----------|
| Already public | Credible public details exist (issue tracker, blog, active exploitation) |
| Reporter agreement | Reporter and maintainers agree in writing (email or advisory thread) to publish early |
| User safety | Withholding information demonstrably increases harm to users (e.g. widespread active exploitation) |
| Scope error | Issue is determined out of scope or not a vulnerability; public closure is appropriate |
| Legal compulsion | Required by law or valid legal process; notify maintainers as allowed |

Under an early-disclosure exception, maintainers should still publish a
formal advisory (even if incomplete) so operators have a single canonical
reference.

## 4. Responsibilities During Embargo

- Maintainers: track the embargo clock, coordinate fixes, and prepare the
  advisory from the [advisory template](../templates/ADVISORY_TEMPLATE.md).
- Reporter: avoid public discussion of exploit details; escalate privately
  if they believe active exploitation requires early disclosure.
- Embargo partners: limit internal distribution to need-to-know individuals.

## 5. Document History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-09-28 | Initial embargo policy (issue #1613) |
