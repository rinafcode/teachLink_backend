# Dependency Audit Runbook

This runbook describes how TeachLink Backend audits its dependencies: what
the audit covers, the checks performed for vulnerabilities and licenses,
and how remediation is tracked to closure. It exists so dependency risk is
found on a schedule instead of after an incident.

This document is part of the project's **Security** area. It lives entirely
inside the `Governance/` folder and does not change application code. The
inventory this runbook audits is `Governance/registers/DEPENDENCY_REGISTER.md`.

## Audit Scope

- **In scope** — every declared dependency of the application and its
  build/deploy toolchain: runtime packages, dev dependencies that run in
  CI, container base images, and third-party SDKs. Each must have an entry
  in `Governance/registers/DEPENDENCY_REGISTER.md`.
- **Out of scope** — example code under `examples/` that is never built,
  and vendored files with no execution path; both are listed as excluded in
  the audit record so the exclusion is a decision, not an oversight.
- **Cadence** — full audit **quarterly**; targeted audits are triggered
  immediately by a public vulnerability affecting any *Core* dependency,
  by a license change reported by a vendor, or by any security incident
  with a dependency origin.

## Vulnerability Checks

1. Run the ecosystem's audit tooling against the locked dependency set
   (for JavaScript, `npm audit` against `package-lock.json`; the lockfile
   is the audit target, not the manifest).
2. Classify every finding: severity, whether the vulnerable code path is
   reachable from the service's runtime behavior, and the fixed version.
3. Reachable High/Critical findings are incidents: they follow Tier 2 of
   `Governance/matrices/ESCALATION_MATRIX.md` immediately, not at the end
   of the audit.
4. Unreachable or lower-severity findings are recorded with their
   classification and the reasoning behind it.

## License Checks

1. Compare every entry's license field in the register against the
   project's approved license list.
2. Flag any dependency whose license is unknown, changed since the last
   audit, or not approved; a flagged dependency may not ship in a release
   until a decision is recorded in
   `Governance/registers/EXCEPTION_REGISTER.md`.
3. Confirm the license text is present in distributed artifacts where the
   license requires it.

## Remediation Tracking

- Every finding becomes an issue labeled for security/dependency work,
  assigned to the **Owner** named in the dependency register.
- The issue records: the finding, its classification, the remediation
  (upgrade, pin, replace, or accepted risk), and a link back to this audit.
- Upgrades are made in a normal pull request; an accepted risk requires an
  exception entry with an expiry date — an accepted risk with no expiry is
  an open finding, not a closed one.
- The audit is not complete until every finding is either merged, under an
  active unexpired exception, or explicitly transferred to a follow-up
  issue with an owner and a date.
- The outcome (findings, remediations, exceptions used) is recorded in the
  quarter's entry in `Governance/reporting/QUARTERLY_GOVERNANCE_REPORT.md`.
