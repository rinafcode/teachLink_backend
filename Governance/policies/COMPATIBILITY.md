# Compatibility and Support Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** TeachLink Backend maintainers
- **Last reviewed:** 2026-10-16
- **Review cadence:** Every 6 months, or when a supported runtime or platform changes

This policy identifies the runtime, database, cache, and operating-system
configurations that TeachLink Backend tests and supports. It also defines how
long a supported version remains eligible for support and when maintainers may
retire it. This is a governance document: it does not itself change application
code or deployment configuration.

## 1. Supported compatibility baseline

The following is the project's currently tested baseline. A version not listed
here may work, but is not guaranteed to pass the project's compatibility checks.

| Component | Supported version or platform | Evidence |
| --- | --- | --- |
| Node.js | 22.x | CI runs on Node 22 |
| PostgreSQL | 16.x | CI and the development Compose configuration use PostgreSQL 16 |
| Redis | 7.x | The development Compose configuration uses Redis 7 |
| Operating system | Ubuntu Linux, x86-64 | CI runs on `ubuntu-latest` |

The `engines` field in `package.json` currently permits Node.js versions
starting at 18. This install-time declaration is broader than the tested
support commitment above: only Node.js 22.x is currently guaranteed by CI.
The declaration is not a promise that every permitted Node.js version is
supported.

Other operating systems, CPU architectures, database versions, and cache
versions are best-effort only unless they are added to the tested matrix.
Maintainers may add versions to the matrix after CI or equivalent repeatable
validation covers them.

## 2. Support window

### Runtime and platform versions

A version listed in §1 remains supported until its announced retirement date.
Maintainers must provide at least **90 calendar days' notice** before removing a
currently supported runtime, database, cache, or platform version from the
support matrix. During that notice period, maintainers will continue to accept
and assess defect and security reports for that version and will make reasonable
efforts to keep it working.

The notice period starts when the retirement is announced in a public tracking
issue or pull request. The announcement must state the affected version, reason,
replacement (if available), and planned retirement date. A longer window may be
provided when a migration requires it.

### TeachLink release lines

Support for application release lines follows
[`SECURITY_POLICY.md`](../SECURITY_POLICY.md): the latest stable release is
supported, and the immediately previous minor release receives security fixes
for at least 90 days after the next minor release ships. Older release lines
are unsupported unless maintainers explicitly announce otherwise. This policy
does not extend or replace that security-support commitment.

## 3. Criteria for retiring a supported version

Maintainers may propose retiring a version when one or more of these conditions
applies:

- Its upstream project has ended security maintenance or no longer provides
  necessary fixes.
- A required dependency or hosting platform has dropped it, leaving no
  practical way to keep the service secure and reliable.
- CI or equivalent repeatable validation can no longer pass on it, and
  maintaining compatibility would create disproportionate reliability or
  maintenance risk.
- Supporting it prevents adoption of a necessary security fix or a supported
  replacement.

Before retirement, maintainers must confirm and record that:

1. The reason and affected versions are documented in the public announcement.
2. A supported replacement or migration guidance is provided where practical.
3. At least the 90-day notice in §2 has elapsed.
4. The support matrix and any directly affected governance documentation are
   updated in the retirement change.

An earlier retirement is permitted only when required to address an active
security risk, legal obligation, or upstream shutdown that makes continued
support impossible. A maintainer other than the proposer must approve the
exception; the reason, approval, affected versions, and practical migration
notice must be recorded publicly unless the security disclosure process
requires confidentiality.

## 4. Verification and review

CI is the authoritative evidence for the tested matrix. Pull requests that add
or retire a supported version must update the matrix and provide passing
compatibility validation for the resulting baseline. Governance-only edits do
not require application regression tests.

This policy is reviewed every six months and whenever the CI runtime or
supported infrastructure changes materially.

## 5. Related documents

- [`SECURITY_POLICY.md`](../SECURITY_POLICY.md) — security support for released
  application versions.
- [`VERSIONING.md`](VERSIONING.md) — versioning of releases and compatibility
  requirements as breaking changes.
- [`DEPRECATION.md`](DEPRECATION.md) — general notice and removal rules.
