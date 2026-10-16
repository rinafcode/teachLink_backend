# Environment Promotion Process

This document governs how code and configuration are promoted across the three
TeachLink Backend environments: **development** (local), **staging**, and
**production**. It defines the promotion path, the gating checks that must pass
at each stage, and the approvals required before a promotion is executed. It
exists so that every promotion follows a single, versioned process rather than
being evaluated ad hoc, and so that a broken change is caught at the earliest
possible stage before it reaches production users.

This policy is part of the project's **Releases & change** area. It lives
entirely inside the `Governance/` folder and does not change application code.

## Scope

A **promotion** is any deliberate act of moving a change from one environment
to the next:

| Transition | Trigger |
|---|---|
| Development → Staging | A pull request merges into the `develop` branch |
| Staging → Production | A pull request merges into the `main` branch |

Out of scope — these are governed elsewhere:

- **Database migration execution.** Running `pnpm run migration:run` against a
  live environment is governed by
  [`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md). A promotion that
  includes a migration follows both this document and that one.
- **Configuration value changes** (new environment variables, flag flips). These
  are governed by [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md). A promotion that
  changes a configuration value follows both.
- **Hotfix promotions.** Emergency fixes that bypass the normal `develop →
  main` flow follow [`../processes/HOTFIX.md`](../processes/HOTFIX.md). The
  gating checks still apply; only the branch path and approval window differ.
- **Rollback.** Reverting a promotion that has already reached production
  follows the rollback procedure in
  [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md) for schema changes, and the
  general rollback guidance in this document for application-only changes.

## Promotion Path

Changes travel through environments in one direction only:

```
development (local)
      │
      │  pull request against develop
      ▼
   staging
      │
      │  pull request against main
      ▼
  production
```

Skipping an environment is not permitted. A change that has not been validated
in staging may not be promoted to production, except for the emergency
exception documented in the Hotfix process.

### Development

Development is each contributor's local machine running the stack described
in `README.md` (NestJS + PostgreSQL + Redis via `docker compose up -d postgres
redis`). There are no shared gating checks at this stage beyond the developer
running the checks listed in the Contributing Guide locally before opening a
pull request.

Recommended local checks before pushing:

```bash
pnpm lint          # lint with auto-fix
pnpm typecheck     # TypeScript type check
pnpm test          # unit tests
pnpm validate:env  # validate environment variables
```

### Development → Staging

A change is promoted to staging by merging a pull request into the `develop`
branch. The CI pipeline defined in `.github/workflows/ci.yml` must pass, and
the branch protection rule for `develop` requires **at least one approving
review** before the merge can proceed.

Once merged, the staging environment is updated by running the full stack
defined in `docker-compose.staging.yml`:

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging.local up -d
```

Staging uses production-parity configuration (see `docs/staging-environment.md`)
with sanitized data refreshed daily by `scripts/staging/sanitize-and-sync.sh`.

### Staging → Production

A change is promoted to production by merging a pull request into the `main`
branch. This is the highest-risk transition and requires the full gating checks
and approvals described below.

## Gating Checks

The gating checks below are **required** at each stage. A promotion is blocked
until every applicable check passes. The CI pipeline enforces the automated
checks; the review requirement enforces the manual checks.

### Automated gating checks (CI — applies to all promotions)

All of the following jobs in `.github/workflows/ci.yml` must pass on the pull
request before it can be merged, for both `develop` and `main`:

| CI Job | Tool | Fails on |
|---|---|---|
| Install | `pnpm install` | Dependency resolution error |
| Lint | ESLint | Any warning or error (`--max-warnings 0`) |
| Format | Prettier | Any file that would be reformatted |
| Type Check | `tsc --noEmit` | Any TypeScript error |
| Build | NestJS CLI | Compilation failure |
| Migrations | TypeORM CLI | Migration error or schema drift |
| Unit Tests | Jest + ts-jest | Test failure or coverage below 70 % |
| E2E Tests | Jest + Supertest | Test failure |

These checks are non-negotiable. No exception, including an urgent fix, waives
an automated gate. If a gate blocks an urgent change, the fix is made to the
change, not to the gate.

### Manual gating checks (staging → production only)

Before a pull request targeting `main` is merged, the author and the reviewing
maintainers must confirm all of the following:

1. **Staging validation.** The change has been running in the staging
   environment and no regressions have been observed. Any smoke tests specific
   to the change have been executed against staging, not only locally.

2. **Migration pre-check.** If the change includes a database migration, the
   migration has been applied to the staging database and the application has
   started successfully against the migrated schema.

3. **Rollback plan stated.** The pull request body names the exact rollback
   procedure for this specific change (see Rollback below).

4. **Related governance satisfied.** If the change includes a configuration
   change, the requirements in [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) are
   met. If it includes a schema migration, the requirements in
   [`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md) are met.

5. **No unrelated changes.** The pull request is scoped to its stated purpose.
   Incidental refactors or unrelated fixes are extracted into separate PRs.

6. **Documentation updated.** If the change adds, removes, or alters a
   behaviour observable to contributors or operators, the relevant
   documentation is updated in the same pull request.

## Approvals per Stage

| Transition | Minimum approving reviews | Who may approve |
|---|---|---|
| Development → Staging (`develop`) | **1** | Any maintainer (see [`../roles/MAINTAINER.md`](../roles/MAINTAINER.md)) |
| Staging → Production (`main`) | **2** (including at least one code owner) | Maintainers; one must be the code owner for the affected area per `CODEOWNERS` |

Branch protection rules are defined in
`.github/workflows/branch-protection.yml` and enforce these requirements
programmatically. Direct pushes to `develop` and `main` are disabled for
everyone including admins; all changes must arrive via a pull request.

Additional sign-offs are required in the following situations:

| Situation | Additional required sign-off |
|---|---|
| Change touches authentication, authorization, or encryption | Security-area reviewer (per [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md)) |
| Change touches payment processing or financial data | Payments-area reviewer |
| Change includes a destructive or irreversible migration step | One extra maintainer beyond the standard count |
| Change affects a Confidential or Restricted data column (per [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md)) | Security-area reviewer |
| Emergency production fix (hotfix path) | Any available maintainer; retroactive sign-off within one business day |

Approvals are recorded on the pull request. Emergency approvals are additionally
recorded in the tracking issue or deployment comment before the merge is
executed, providing an auditable trail.

## Rollback

### Application-only changes

If a promotion to production introduces a regression, the fastest rollback path
is a revert commit on `main`. This creates a new commit that undoes the change,
follows the same CI and approval gates as any other promotion, and does not
require modifying Git history.

```bash
git revert <merge-commit-sha> --no-commit
git commit -m "revert: revert <original-change-description>"
# open a pull request targeting main
```

A revert PR targeting `main` requires the same two-approval gate as any other
production promotion.

### Changes that include a schema migration

Reverting application code does not automatically revert the database schema.
Follow [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md) for the schema
rollback procedure, including the additional approvals required for
irreversible steps.

### Emergency rollback

If a production incident requires an immediate rollback and the pull-request
path is too slow, a maintainer may revert directly, subject to:

1. The CI suite still runs on the revert commit (do not skip checks with
   `--no-verify` unless the CI system itself is the cause of the incident).
2. The decision is recorded immediately in the incident tracking issue.
3. Retroactive review is completed within one business day.
4. A post-incident review is opened per [`POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md).

## Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces
no runtime behaviour, no schema change, and no executable code, so it adds no
tests and requires none. The governance process itself is validated by the CI
pipeline: every promotion goes through lint, typecheck, build, unit tests, and
E2E tests as described above, and the branch protection rules enforce that no
merge to `develop` or `main` bypasses those checks.

When a new promotion-related feature is added to the codebase (for example, a
deployment health-check script or a migration pre-check tool), that feature
ships with the corresponding unit or integration tests per the project's testing
standards in `docs/TESTING_GUIDELINES.md`.

Existing lint, typecheck, build, and test suites must continue to pass, and
this document is verified by the standard CI pipeline described in
`CONTRIBUTING.md`.

## Review

This policy is reviewed whenever the environment topology, the CI pipeline
structure, or the branch protection rules change materially, or when a
production incident reveals a gap in the promotion process. Changes are
proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder (and at
most one additional file if a cross-reference in `Governance/README.md` must
be updated).

## Related Documents

- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — configuration changes that accompany
  a promotion.
- [`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md) — gating and
  approval rules for database migrations included in a promotion.
- [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md) — rollback procedure for
  schema changes applied during a promotion.
- [`SCHEMA_CHANGE.md`](SCHEMA_CHANGE.md) — schema design rules that apply
  within a promoted migration.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — who owns each service area
  and who must sign off on area-specific promotions.
- [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md) — classification rules
  for data changes included in a promotion.
- [`POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md) — post-incident review for
  emergency rollbacks following a failed promotion.
- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording for promotions that touch
  Confidential or Restricted data.
- [`../processes/HOTFIX.md`](../processes/HOTFIX.md) — the promotion path for
  emergency fixes that bypass the normal `develop → main` flow.
- [`../README.md`](../README.md) — the governance structure this document
  belongs to.
- [`docs/staging-environment.md`](../../docs/staging-environment.md) — staging
  environment setup, configuration parity, and the data-sync process.
