# Release Manager

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-30
- **Review cadence:** Every 6 months, or after a material change to release, CI, or branch-protection requirements

This document defines the **release manager** role for TeachLink Backend: the
role's duties, its sign-off authority and its explicit limits, and the rotation
process that decides who holds it.

The release manager is a **delegated functional appointment, not a rung on the
promotion ladder** defined in
[`../processes/PROMOTION_CRITERIA.md`](../processes/PROMOTION_CRITERIA.md)
(Contributor → Reviewer / Issue Triager → Committer → Maintainer → Lead
Maintainer). Appointment to this role neither promotes nor demotes anyone; the
member's standing is whatever role they already hold.

This document does **not** restate the release process. The normative references
remain [`../processes/RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) for
sign-off and final authorization, and
[`../policies/VERSIONING.md`](../policies/VERSIONING.md) for version levels and
the release steps. Where this document and either of those overlap, they win.

---

## 1. Scope

**Applies to** the maintainer holding the release manager appointment for a
given release, and to the maintainers who appoint, review, and remove it.

**Covers** the operational work of cutting a release: determining the version,
preparing the release pull request and notes, assembling sign-off evidence,
coordinating verification, tagging, and recording the outcome.

**Does not cover:**

- The final go/no-go decision for a production release. That authority belongs to
  the lead maintainer under
  [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §4 and is not
  transferable to this role.
- The required approvals, gating checks, and specialist sign-offs, which are
  fixed by [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §2–3 and
  [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md). This role
  assembles evidence for them; it never relaxes them.
- Emergency production fixes, which follow
  [`../processes/HOTFIX.md`](../processes/HOTFIX.md).
- Development-to-staging promotion, which is governed by
  [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md).

## 2. Duties

The release manager for a release:

1. **Determine the version level.** Review the merged pull request set against
   the MAJOR/MINOR/PATCH criteria in
   [`../policies/VERSIONING.md`](../policies/VERSIONING.md) §§5–7 and apply the
   highest applicable level. The level and its triggering change set are stated
   in the release pull request so reviewers can verify the choice.
2. **Open the release pull request.** Update the version in `package.json` in a
   dedicated `chore(release)` pull request, per
   [`../policies/VERSIONING.md`](../policies/VERSIONING.md) §12. The repository
   tooling is `release:dry-run` to preview, then `release:patch`,
   `release:minor`, or `release:major`; `release:auto` and `version:next` are
   advisory and never override the documented criteria.
3. **Write the changelog and release notes.** The notes state the version, its
   level, any pre-release identifier, and **every breaking change with its
   migration instruction** (§12.5). The root `CHANGELOG.md` entry is produced
   under [`../policies/CHANGELOG_POLICY.md`](../policies/CHANGELOG_POLICY.md),
   which also requires an entry for governance changes such as this one.
4. **Assemble sign-off evidence.** Confirm each applicable sign-off in
   [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §2 is present, and
   each gating check in §3 and each release-readiness item in §3 is satisfied,
   attaching the staging and CI evidence to the release pull request.
5. **Coordinate verification.** Ensure the release candidate is deployed to and
   validated in staging, that any included migration has been applied and
   verified there, and that the change-specific rollback plan is stated and
   actionable.
6. **Tag the release.** Create the immutable `v<version>` tag, per
   [`../policies/VERSIONING.md`](../policies/VERSIONING.md) §12. A published tag
   is never moved; a correction ships as a new version.
7. **Refresh generated artifacts where the contract moved.** When the release
   changes the public API surface, regenerate the OpenAPI specification and the
   SDKs with `sdk:generate`, and archive superseded documentation with
   `docs:version`, so published artifacts match the released contract.
8. **Record the decision and the outcome.** Record the go/no-go decision,
   version, final authorizer, evidence links, specialist approvals, and
   rollback plan before merging or tagging; after deployment, add the
   revision, verification outcome, and any rollback or follow-up actions to the
   same record, per
   [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §4.
9. **Hand over.** On rotation, brief the incoming release manager per §4 below.

## 3. Sign-Off Authority

[`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §2 fixes the sign-offs
for a release. The release manager's involvement in each is:

| Sign-off                     | Who provides it                                                                                     | Release manager's role                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Release owner                | The release manager, or the pull request author                                                     | May hold this sign-off. Authorship **does not count** as one of the required independent approving reviews (§2). |
| Maintainer review            | Two maintainers for a pull request targeting `main`                                                 | Assembles the evidence; has no casting vote over the reviews.                                                    |
| Code-owner review            | At least one of the two main-branch maintainers, who must be a code owner for the affected area     | Confirms the code-owner requirement is met; may not stand in as the code owner for an area they do not own.      |
| Additional specialist review | Security-area, payments-area, or additional maintainer reviewer when `ENV_PROMOTION.md` requires it | Requests the review early; may not waive or self-approve it.                                                     |
| Final release authorization  | Lead maintainer, or an acting lead maintainer named before the release decision                     | **Never the release manager.** Requests authorization once every gate is green, and defers if it is not.         |

**Explicit limits.** A release manager:

- **Cannot grant final authorization.** Final go/no-go stays with the lead
  maintainer ([`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §4). If
  neither the lead maintainer nor a pre-named acting lead maintainer is
  available, a normal release is **deferred** — the release manager does not
  substitute for them, and an urgent production fix goes through
  [`../processes/HOTFIX.md`](../processes/HOTFIX.md) instead.
- **Cannot approve their own work.** Holding the release owner sign-off never
  satisfies the independent maintainer or code-owner review requirements, and
  the release manager may not merge their own release pull request beyond the
  normal rule that contributors cannot self-merge
  (`CONTRIBUTING.md` §11).
- **Cannot relax a gate.** No release manager may waive a required automated
  check, a branch-protection rule, the approval counts in
  [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md), or a specialist
  sign-off. Where a gate fails, the release is blocked or rolled back, not
  authorized around.
- **Cannot act as a release coordinator and an authorizer at once.** The two
  are separate duties held by separate people for the duration of a release, so
  the person who assembles the evidence is never the person who rules on it.
- **May not move a published tag.** Corrections are new versions
  ([`../policies/VERSIONING.md`](../policies/VERSIONING.md) §4).

The purpose of these limits is that the release manager makes releases
_repeatable and auditable_, not that it makes them _unattended_. Separation of
duties for releases follows the same principle as elsewhere in this repository's
governance: see the separation-of-duties rule in
[`../domains/ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md) §2.3.

## 4. Rotation

**Cadence: one appointment per release.** The release manager is appointed for a
single release and a different maintainer takes the next one. This is the
narrowest useful term: it keeps the role from hardening into a standing shadow
authority, and it guarantees that the person cutting a release is not the person
who will authorize the following one.

- **Appointment.** The maintainers appoint a release manager for each release and
  record the appointment in
  [`../DECISION_LOG.md`](../DECISION_LOG.md). The appointee must be a current
  maintainer with the GitHub role able to act on release automation.
- **One term, then rotate.** A single maintainer may hold two consecutive terms
  only with an explicit, recorded agreement between them and the maintainers,
  mirroring the rule in [`../domains/ON_CALL.md`](../domains/ON_CALL.md) for
  consecutive on-call shifts.
- **Handover is explicit.** The outgoing release manager briefs the incoming one
  on: the current release state and what remains unmerged; any sign-off still
  outstanding and who is providing it; migration status in staging; known
  release blockers or items being watched; and any follow-up actions owed from a
  previous release. The incoming manager starts from a known state rather than a
  clean slate.
- **Backup.** A backup release manager is named at appointment time. Declared
  unavailability is announced ahead of the release and covered by that backup.
  If neither is available, the release is deferred rather than cut by whoever
  happens to be available.
- **Review.** The rotation is reviewed alongside the quarterly on-call review in
  [`../domains/ON_CALL.md`](../domains/ON_CALL.md): whether releases have been
  cut by a single person repeatedly, whether handovers are happening, and
  whether any release is waiting on a sign-off for an unreasonable time.
- **Change and exit.** Appointment, handover, backup use, and removal are each
  recorded in [`../DECISION_LOG.md`](../DECISION_LOG.md). A release manager who
  becomes inactive follows
  [`../policies/INACTIVITY.md`](../policies/INACTIVITY.md). A maintainer who
  steps down from the appointment — and from maintainership itself — does so
  under
  [`../processes/EMERITUS_TRANSITION.md`](../processes/EMERITUS_TRANSITION.md).
  Repository and release automation access is revoked per
  [`../processes/OFFBOARDING.md`](../processes/OFFBOARDING.md).

## 5. Regression Tests Where Applicable

**Not applicable to this document.** This is a documentation-only change: it adds
Markdown and modifies no TypeScript, configuration, schema, or dependency.
`Governance/` is outside the Jest root (`jest.config.js` sets `rootDir: 'src'`),
outside the TypeScript build (`tsconfig.build.json` includes `src/**/*`), and
excluded from container images by the `*.md` rule in `.dockerignore`. No test was
added and none was modified.

No test asserts on the prose of a role document: such a test would encode the
text rather than the rule, and would fail on every legitimate rewording. The
enforceable requirements for releases are the automated CI gates and the approval
rules in [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §3 and
[`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md), which run per
release rather than per document.

The verifiable obligations this document does create are checks maintainers
perform, not automated tests:

- Every relative link in this document resolves to a file that exists.
- Every `CONTRIBUTING.md` section reference is checked against the current file.
- Every `package.json` script named in §2 exists.
- Every sign-off in §3 corresponds one-to-one to a sign-off in
  [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §2, with no row added
  or dropped.

## 6. Documenting Changes

- **Amendments** are submitted as a pull request confined to the `Governance/`
  directory, touching at most two files
  ([`README.md`](../README.md)).
- **Substantive changes** — changing who holds the appointment, the term length,
  or the sign-off limits — require asynchronous review and consensus under
  [`../policies/ASYNC_DECISIONS.md`](../policies/ASYNC_DECISIONS.md).
- **Conflict resolution.** If this document and
  [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) disagree about who
  authorizes a release, the disagreement is raised as an issue and resolved by
  the maintainers before any release relies on it. Neither document is applied
  unilaterally in the meantime.
- **Decision log.** Appointment to the role, and any material change to it, is
  recorded in [`../DECISION_LOG.md`](../DECISION_LOG.md).
- **Change log:**

| Version | Date       | Description of Change                                                                                                                                                           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-09-30 | Initial release manager role: duties, sign-off authority and its limits, and a per-release rotation. Closes the missing role definition for the release function (issue #1558). |

## 7. Related Documents

- [`../processes/RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) — required sign-offs, gating checks, and final authorization. Authoritative.
- [`../policies/VERSIONING.md`](../policies/VERSIONING.md) — version levels, pre-release conventions, and the release steps. Authoritative.
- [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md) — promotion path, approvals per stage, and rollback.
- [`../processes/HOTFIX.md`](../processes/HOTFIX.md) — expedited emergency production changes.
- [`../policies/CHANGELOG_POLICY.md`](../policies/CHANGELOG_POLICY.md) — required changelog format and when an entry is required.
- [`../domains/ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md) — separation of duties and least-privilege principles.
- [`../domains/ON_CALL.md`](../domains/ON_CALL.md) — the rotation model and handover conventions this role mirrors.
- [`../roles/MAINTAINER.md`](MAINTAINER.md) — the role within which this appointment is held.
- [`../processes/PROMOTION_CRITERIA.md`](../processes/PROMOTION_CRITERIA.md) — the promotion ladder, which this role sits outside.
- [`../processes/EMERITUS_TRANSITION.md`](../processes/EMERITUS_TRANSITION.md) and [`../processes/OFFBOARDING.md`](../processes/OFFBOARDING.md) — stepping down and access revocation.
- [`../README.md`](../README.md) — governance structure and the role index.

## 8. Known Limitations

- The **lead maintainer** is the escalation target and the holder of final
  release authority, but `Governance/roles/LEAD_MAINTAINER.md` does not yet
  exist. It is referenced by [`MAINTAINER.md`](MAINTAINER.md) and
  [`../processes/PROMOTION_CRITERIA.md`](../processes/PROMOTION_CRITERIA.md).
  This document therefore describes the role by reference to
  [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) §4 rather than linking
  to a file that is not there.
- **No `CODEOWNERS` file exists** at the repository root, although the code-owner
  sign-off in §3, `CONTRIBUTING.md` §9,
  [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md), and
  [`RELEASE_SIGNOFF.md`](../processes/RELEASE_SIGNOFF.md) all reference it as
  authoritative. Until it does, "code owner" resolves through the module
  ownership map in [`../domains/SERVICE_OWNERSHIP.md`](../domains/SERVICE_OWNERSHIP.md).
- **There is no `develop` branch** in this repository, so the development-to-staging
  promotion stage in [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md)
  is not currently exercisable as written. This does not affect the production
  release path this role covers.
- **Section numbers in
  [`../policies/VERSIONING.md`](../policies/VERSIONING.md) are cited by their
  heading numbers, not its table of contents.** That document's table of contents
  is offset by one from its actual headings (it lists "Release process" as 11,
  while the heading is `## 12. Release process`). The section references in
  §2 follow the heading numbers, which is also the convention that document's own
  prose uses internally ("sections 5–7", "sections 4–6"). A reader following its
  table of contents will land one section earlier than intended.

## Contact

For questions about this role, contact the maintainer team. For a question about
a specific release in flight, raise it on the release pull request so the answer
is recorded with the decision. For a security concern, do not open a public
issue — follow [`../SECURITY_POLICY.md`](../SECURITY_POLICY.md).
