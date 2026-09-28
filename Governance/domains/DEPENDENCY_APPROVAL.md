# Dependency Approval Policy

This policy governs adding, upgrading, or replacing a runtime dependency in
TeachLink Backend. It provides a versioned decision record for why a package
is needed, who owns it, and which security checks must pass before merge.

The policy applies to packages in `package.json`, transitive dependency
overrides, and tools that run in CI or production. A dependency that is only
used in a local experiment must not be added to the repository.

## Approval criteria

The issue or pull request proposing a dependency must answer each question
below before review:

- **Capability:** What concrete user or operational problem does it solve?
- **Alternatives:** Why existing platform code or an already-approved package
  cannot provide the capability.
- **Scope:** Which service imports it, and does it run at build time, in CI, or
  in production?
- **Data access:** Does it process credentials, student data, payment data, or
  other personal information? The smallest required data footprint must be
  stated.
- **License:** Is the package and its transitive license set compatible with
  this project? Record any copyleft or commercial restrictions.
- **Maintenance:** Is there a stable release, an active maintainer, and a
  published security contact? Avoid abandoned packages and unreviewed forks.
- **Operational cost:** What are the bundle, startup, memory, network, and
  failure-mode impacts? The change must define a safe fallback for optional
  functionality.

The dependency owner must also specify the version range, package manager
lockfile change, upgrade cadence, and removal plan if the package becomes
unmaintained.

## Review owner

The **primary service owner** reviews functional and operational fit. A
**maintainer with security responsibility** reviews any package that handles
authentication, authorization, uploads, personal data, cryptography, network
requests, or deployment. If no service owner is recorded, the general
maintainer rotation is the owner and the issue must name the reviewer before
approval.

The approving maintainer is responsible for ensuring the dependency remains
owned after merge. Ownership transfers must be recorded in the issue and in
the relevant service ownership documentation.

## Required security gate

The pull request must attach the results of the repository’s dependency checks
for the exact lockfile being merged:

1. Run `npm audit --audit-level=high` from the repository root and resolve or
   explicitly accept every high or critical finding. An accepted finding must
   include impact, affected code path, compensating control, and an owner with
   a review date.
2. Run the repository’s secret and malware scanning checks in CI. A new
   dependency must not introduce install scripts, downloaded binaries, or
   remote code execution without explicit maintainer approval.
3. Confirm the lockfile is included and that the package comes from the
   expected registry and publisher. Do not use a floating git branch or an
   unpinned URL.
4. Review the dependency tree for unexpected packages, network access, and
   post-install hooks. Document any that are required.

CI is the merge gate: a dependency PR cannot merge while the security scan is
red or has not run. If the scan is unavailable, a maintainer may approve only
an emergency patch with a documented expiry and a follow-up issue.

## Testing and rollout

Add regression coverage for the behavior introduced by the dependency where
the repository has an applicable test boundary. At minimum, the PR must pass
the affected unit/integration tests, lint, build, and the dependency security
gate. For a dependency that changes startup or runtime behavior, include a
smoke test covering both the healthy path and the documented fallback.

Roll out changes that affect authentication, payments, data storage, or
external calls behind the normal deployment checklist. Monitor error rate,
latency, memory, and dependency-specific failures after release. Roll back or
disable the integration if it violates the stated failure behavior.

## Exceptions and review cadence

Exceptions require a maintainer comment on the tracking issue with the reason,
risk acceptance, compensating controls, owner, and expiry date. Exceptions do
not bypass license review or secret scanning.

Maintainers review direct dependencies quarterly and whenever a security
advisory is published. Unused, unmaintained, or ownerless dependencies are
removed through a tracked pull request. This policy is reviewed annually and
whenever the project’s package manager or security pipeline changes.
