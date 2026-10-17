# End-of-Life Policy

| Field | Value |
| --- | --- |
| Document | `Governance/policies/END_OF_LIFE.md` |
| Status | Active |
| Version | 1.0.0 |
| Owner | Maintainer Team |
| Last reviewed | 2026-10-17 |
| Review cadence | Every 12 months |
| Applies to | Major versions of the platform and its public API surfaces |
| Related | [`policies/DEPRECATION.md`](DEPRECATION.md) · [`domains/API_DEPRECATION.md`](../domains/API_DEPRECATION.md) · [`policies/VERSIONING.md`](VERSIONING.md) |

This policy defines how a supported version reaches end of life (EOL), how EOL
is announced, the stages by which support is reduced, and the migration guidance
users are given. It covers whole major versions and major API surfaces; the
removal of an individual endpoint is governed by
[`domains/API_DEPRECATION.md`](../domains/API_DEPRECATION.md).

## 1. How EOL is decided and announced

- **Decided by the maintainers.** EOL for a major version is decided by the
  maintainer team and recorded on a public issue linked from this document.
- **Driven by supportability, not caprice.** Drivers include security risk from
  unpatched dependencies, the cost of maintaining multiple lines, a new major
  that supersedes the old, or an upstream end of support.
- **A minimum support window.** A major version is supported for at least
  **12 months** from its release, and at least **6 months** after a successor
  major is released, whichever is longer — unless a security or legal reason
  forces an earlier EOL.
- **Announced early and often.** EOL is announced at least **90 days** before
  the final support date, through the release notes, the repository README, and
  the product notice channel. The announcement names the final support date and
  the replacement version.
- **Recorded.** The EOL date and the decision are recorded in
  [`Governance/CHANGELOG.md`](../CHANGELOG.md) and on the version's release notes.

## 2. Support-reduction stages

| Stage | What still happens | What stops |
| --- | --- | --- |
| **Active** | Full support: features, bug fixes, security fixes, and releases. | — |
| **Maintenance** | Security fixes and critical bug fixes only; no new features. | New features; non-critical fixes. |
| **Deprecated** | Security fixes only, with a published EOL date. | Bug fixes; documentation improvements beyond migration notes. |
| **End of life** | No further fixes or releases of any kind. | All support; the version is archived. |

- A version moves Active → Maintenance when its successor ships, or earlier if
  the maintainers say so.
- A version moves to Deprecated when the EOL date is set; the deprecation notice
  follows the period and channels in [`policies/DEPRECATION.md`](DEPRECATION.md).
- At EOL the version is archived: releases stop, and any open issues or pull
  requests against it are closed or migrated to the current version.

## 3. Migration guidance

- **Publish a migration path before EOL.** At least 90 days before the final
  support date, publish a migration guide that names the replacement version and
  the breaking changes between them.
- **Make the change mechanical where possible.** Prefer a documented
  configuration or code change over a forced rewrite; ship codemods or examples
  when they materially reduce effort.
- **Provide a compatibility bridge when feasible.** If a shim can keep old
  clients working through the transition, offer it and document its own removal
  date.
- **Keep the guide in the release notes**, linked from the EOL announcement, so
  it is discoverable after the announcement scrolls away.
- **Answer migration questions** in the repository's support channels for the
  duration of the support window.

## 4. Emergency EOL

If a version must be retired faster than §1 allows — for example, a critical
unpatched upstream vulnerability — the maintainers may shorten the window. In
that case they publish the reason, the new final support date, and any interim
mitigation as soon as it is safe to do so, and follow
[`SECURITY_POLICY.md`](../SECURITY_POLICY.md).

## 5. Change log

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-17 | 1.0.0 | Initial release. |
