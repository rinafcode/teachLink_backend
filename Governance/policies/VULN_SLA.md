# Vulnerability Remediation SLA

| Field | Value |
| --- | --- |
| Document | `Governance/policies/VULN_SLA.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team, with the security response team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 6 months |
| Applies to | Vulnerabilities in the project's code, dependencies, and infrastructure |
| Related | [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) · [`SECURITY_SEVERITY_RUBRIC.md`](../SECURITY_SEVERITY_RUBRIC.md) · [`SECURITY_RESPONSE_TEAM.md`](../SECURITY_RESPONSE_TEAM.md) · [`processes/VULN_DISCLOSURE.md`](../processes/VULN_DISCLOSURE.md) |

This policy sets the remediation targets for each severity, how those targets are
measured, and the escalation that happens when a target is missed. Severity is
assigned using [`SECURITY_SEVERITY_RUBRIC.md`](../SECURITY_SEVERITY_RUBRIC.md);
this policy only defines the clock that starts once severity is known.

## 1. Remediation targets per severity

| Severity | Example | Time to mitigate / fix from triage |
| --- | --- | --- |
| **Critical** | Remote code execution, auth bypass, active data exposure | Mitigate within **24 hours**; permanent fix within **7 days** |
| **High** | Privilege escalation, significant data leak, exploitable injection | Mitigate within **72 hours**; permanent fix within **30 days** |
| **Medium** | Limited-impact issue, requires unusual conditions | Fix within **90 days** |
| **Low** | Defence-in-depth, minor information leak | Fix within **180 days**, or accept with a documented rationale |

- **"Mitigate"** means the exploitable path is closed or safely gated — a patch,
  a config change, a feature flag, or a documented compensating control. A
  mitigation is not a promise of a permanent fix.
- **"Fix"** means the vulnerable code or dependency is corrected and shipped.
- **Clock start.** The target clock starts when the report is triaged and rated,
  not when it is first reported. Triage itself follows
  [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) and
  [`processes/VULN_DISCLOSURE.md`](../processes/VULN_DISCLOSURE.md).
- **Dependency vulnerabilities** follow the same clock, counted from the moment
  the finding enters our tracking (for example, a Dependabot alert triaged by the
  team).

## 2. Measurement

- **Every finding is tracked** with an owner, a severity, a triage date, and the
  target date derived from §1. The security response team keeps the register.
- **Time is measured in the project's primary timezone, in 24-hour days**, and
  excludes time blocked waiting on a coordinated disclosure date agreed with a
  reporter.
- **Two metrics are reported** for each severity: the percentage mitigated or
  fixed within target, and the age of any currently open finding past target.
  These feed the security section of
  [`policies/TRANSPARENCY_REPORTS.md`](TRANSPARENCY_REPORTS.md).
- **Honest reporting.** A finding that misses its target is not removed from the
  register; it is marked overdue with the reason.

## 3. Escalation when a target is missed

1. **At 50% of the window**, if a finding has no owner or no plan, the security
   response team assigns one and posts the plan on the tracking issue.
2. **At the target date**, an incomplete finding is marked overdue and escalated
   to the lead maintainer with the reason and a revised date.
3. **Every 7 days past target**, the overdue status is re-escalated until the
   finding is fixed or formally accepted.
4. **For Critical and High findings**, a missed target also triggers a
   user-facing communication decision under
   [`SECURITY_POLICY.md`](../SECURITY_POLICY.md): whether a mitigation advisory
   or workaround should be published even before the fix ships.
5. **Accepted risk.** A maintainer may formally accept a Low or Medium finding in
   place of a fix; the acceptance names the rationale, the accepting maintainer,
   and a review date. Critical and High findings may not be closed by acceptance
   alone.

## 4. Reporting channels

- External reports follow [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) and stay
  private. This SLA governs the internal remediation clock; it does not change
  how a vulnerability is reported or disclosed.
- The response team's roles and coverage are defined in
  [`SECURITY_RESPONSE_TEAM.md`](../SECURITY_RESPONSE_TEAM.md).

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
