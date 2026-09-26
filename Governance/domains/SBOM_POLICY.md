# SBOM Policy

This document governs how the Software Bill of Materials (SBOM) for TeachLink
Backend is generated, where it is published, and how often it is updated. It
exists so that consumers, maintainers, and security tooling have a single,
versioned reference for the project's software supply chain.

This policy is part of the project's **Security & disclosure** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Scope

This policy covers the SBOM for the production build of TeachLink Backend:
the runtime dependencies declared in `package.json`, the transitive
dependencies resolved in the lockfile, and any tooling that ships with the
build. It does not cover development-only dependencies that never reach a
production artifact, though those are listed in a separate, clearly labeled
dev SBOM where one is generated.

## When an SBOM Is Generated

An SBOM is generated for:

- **Every release.** The release pipeline produces an SBOM for the exact
  artifact being published, pinned to the release tag.
- **On every merge to the main branch.** A pre-release SBOM is generated and
  published for the current commit, so that downstream tooling can track
  supply-chain changes between releases.
- **When a dependency changes.** Any pull request that modifies
  `package.json` or the lockfile triggers SBOM generation as part of the
  dependency approval gate (`Governance/domains/DEPENDENCY_APPROVAL.md`); the
  SBOM diff is attached to the pull request so reviewers can see what enters
  or leaves the supply chain.
- **On demand.** A maintainer may regenerate the SBOM for any tag or commit
  for incident response or a security advisory.

## Where It Is Published

- The canonical SBOM is published as an **attachment to each release** on the
  project's release page, in a machine-readable format (CycloneDX JSON).
- A copy is retained in the **repository's `sbom/` directory** (or the
  equivalent artifact location) for the current and previous release, so the
  SBOM is discoverable without leaving the repository.
- The pre-release SBOM for the main branch is published to the project's
  artifact hosting, keyed by commit SHA.
- The SBOM is also made available to the repository's dependency scanning
  pipeline, which consumes it to reconcile declared dependencies against
  scanned ones.

## Update Cadence

- **Release-driven.** The SBOM is updated whenever a release is cut — this is
  the authoritative update, and the release SBOM is never regenerated after
  the fact.
- **Continuous.** The main-branch SBOM is updated on every merge, so the
  supply-chain record lags the code by at most one merge.
- **On dependency change.** As above, any dependency-changing pull request
  updates the SBOM as part of its CI checks.
- **On tooling change.** A change to the SBOM generator itself (format,
  version, scan configuration) is itself a tracked change and produces a new
  SBOM, so generator drift is visible in the diff rather than silent.

If the SBOM generation fails in CI, the release is blocked: an accurate SBOM
is a release requirement, not a post-release nicety.

## SBOM Content

Each SBOM records, at minimum:

- All direct and transitive dependencies with name, version, and license.
- The package manager and lockfile the SBOM was derived from.
- The build/manifest hash the SBOM corresponds to.
- Any dependency that was overridden or excluded, with the reason.

## Regression Tests

SBOM correctness is verified by the pipeline, not asserted only in this
document:

- The SBOM generation step is a CI job; a failure blocks merge and release.
- The dependency approval gate requires the SBOM diff to be attached to any
  dependency-changing pull request.
- Where the repository has applicable test boundaries, changes to SBOM
  generation or consumption are covered by tests in the same change.

## Review

This policy is reviewed at least once a year, or whenever the SBOM format,
generator, or publication location changes materially. Changes are proposed
through the normal governance process described in `Governance/README.md` and
must touch only the `Governance/` folder.