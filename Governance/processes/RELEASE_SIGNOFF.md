# Release Sign-Off Process

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-28
- **Review cadence:** Every 6 months, or after a material change to release, CI, or branch-protection requirements

This process defines the required reviews, checks, and final go/no-go authority
for TeachLink Backend releases. It makes release readiness auditable and
complements the detailed promotion requirements in
[`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md). It lives entirely
inside `Governance/` and does not change application behavior.

## 1. Scope

This process applies to normal production releases promoted from staging to
production through a pull request targeting `main`. Development-to-staging
promotion must satisfy the applicable requirements in
[`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md). Emergency
production fixes follow [`HOTFIX.md`](HOTFIX.md), including its expedited
review, verification, and follow-up requirements.

## 2. Required Sign-Offs

Sign-offs are recorded as approving reviews on the release pull request. A
release is not authorized until all applicable sign-offs and gates below are
complete.

| Sign-off | Required from | What is confirmed |
|---|---|---|
| Release owner | Pull request author or designated release coordinator | Release scope, version and notes are accurate; staging validation, applicable migration/configuration reviews, and a change-specific rollback plan are documented. |
| Maintainer review | Two maintainers for a pull request targeting `main` | The change is ready for production and the required manual checks have evidence. |
| Code-owner review | At least one of the two main-branch maintainers, who must be a code owner for the affected area | The affected area has been reviewed by its designated owner under `CODEOWNERS`. |
| Additional specialist review | Security-area reviewer, payments-area reviewer, or additional maintainer when required by `ENV_PROMOTION.md` | The applicable security, financial-data, or destructive-migration risk has been reviewed. |
| Final release authorization | Lead maintainer, or a named acting lead maintainer assigned before the release decision | All required sign-offs and gates are satisfied and the release is a go. |

The release owner may be a maintainer, but their authorship does not count as
one of the required independent approving reviews. A release coordinator may
organize evidence but cannot replace any required reviewer or the final
authorizer.

## 3. Gating Checks

Every applicable check must pass before production release. No release
authorizer may waive a required automated check or branch-protection rule.

### Automated checks

The required CI pipeline on the release pull request must pass, including:

- Dependency installation and resolution.
- Lint and formatting checks.
- TypeScript type checking and NestJS build.
- Database migration validation and schema-drift checks.
- Unit tests, including the configured coverage threshold.
- End-to-end tests.
- Any other required status check enforced by `main` branch protection.

The CI workflow and `main` branch-protection configuration are authoritative
if their job names or implementation change; all required checks must remain
green.

### Release-readiness checks

Before authorizing release, the release pull request must show:

1. The change has been deployed to and validated in staging, including relevant
   smoke tests, with no known release-blocking regression.
2. Any included database migration has been applied and verified in staging.
   Migration-specific approvals and safeguards follow
   [`../domains/DB_MIGRATION_GOVERNANCE.md`](../domains/DB_MIGRATION_GOVERNANCE.md).
3. Any included configuration change satisfies
   [`../domains/CONFIG_CHANGE.md`](../domains/CONFIG_CHANGE.md).
4. The change-specific rollback or recovery plan is stated and actionable.
5. Relevant release notes and user- or operator-facing documentation are
   updated.
6. All review conversations are resolved, the change is limited to its stated
   purpose, and branch protection permits the merge.

Required approvals and checks are those enforced by branch protection and
specified in `ENV_PROMOTION.md`; this process does not replace or reduce them.

## 4. Final Authority and Decision Record

The lead maintainer has final go/no-go authority for a normal production
release. If the lead maintainer is unavailable, the lead must have named an
acting lead maintainer before the release decision. If neither is available,
defer a normal release; an urgent production fix may use the separate hotfix
process.

The final authorizer confirms that evidence is present and requirements are
met. This authority does not permit bypassing CI, branch protection, required
independent reviews, or specialist sign-offs. If maintainers disagree, the
lead maintainer's decision is final, but a release still cannot proceed while
any mandatory gate is failing or incomplete.

Record the go/no-go decision in the release pull request before merging or
tagging. The record must include the decision, release version or identifier,
the final authorizer, links to staging and CI evidence, any applicable
specialist approvals, and the rollback plan. After deployment, add the
deployment revision, verification outcome, and any rollback or follow-up
actions to the same release record.

## 5. Regression Tests Where Applicable

This is a governance-only documentation change. It introduces no executable
code or runtime behavior, so no regression test is applicable. For releases
covered by this process, the required unit and end-to-end test gates are
specified above and in `ENV_PROMOTION.md`.

## 6. Review and Change Log

Maintainers review this process at least every six months and whenever release,
CI, or branch-protection requirements materially change. Changes follow the
normal governance pull-request process and are limited to the `Governance/`
folder.

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-28 | Initial release sign-off process, gating checks, and final authorization. |

## 7. Related Documents

- [`../domains/ENV_PROMOTION.md`](../domains/ENV_PROMOTION.md) — promotion path, gates, approvals, and rollback.
- [`HOTFIX.md`](HOTFIX.md) — expedited emergency production changes.
- [`../roles/MAINTAINER.md`](../roles/MAINTAINER.md) — maintainer responsibilities and decision authority.
- [`../README.md`](../README.md) — governance structure and contribution process.
