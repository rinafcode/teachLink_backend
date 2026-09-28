# Database Migration Governance Policy

This document governs the full lifecycle of database migrations in the
TeachLink Backend project: what must happen before a migration is written, the
review a migration must pass before it merges, and the production-apply
approval required before it is executed against a live environment. It exists
so that every migration follows a single, versioned process rather than being
evaluated ad hoc, and so that a migration's risks are identified and mitigated
before they reach production.

This policy is part of the project's **Releases & change** area. It lives
entirely inside the `Governance/` folder and does not change application code.

For the specific procedure that governs **rolling back** a migration that has
already been applied, see [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md).
For the rules governing **schema design** choices within a migration, see
[`SCHEMA_CHANGE.md`](SCHEMA_CHANGE.md).

## Scope

A **database migration** is a versioned, ordered change to the database schema
applied by TypeORM and recorded in the `migrations` table:

- Migrations under `src/migrations/` (the primary location, applied against
  `src/config/datasource.ts`), named
  `<13-digit-timestamp>-<kebab-case-description>.ts`.
- Migrations that live inside a feature module and follow the same
  `MigrationInterface` convention (`src/achievements/migrations/`,
  `src/notifications/migrations/`).

Out of scope — these are not schema migrations and are governed elsewhere:

- Application-level data reversal (restoring a course version, rolling back a
  transaction in `src/common/database/transaction-helper.service.ts`).
- Incident auto-remediation
  (`src/incident-management/services/auto-remediation.service.ts`) and canary
  deployment rollback (`src/canary/`).
- Configuration changes that do not modify the database schema (governed by
  [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md)).

## Migration Review Requirement

Every migration pull request is reviewed by at least one maintainer before it
merges. The review is of the committed migration files, not of a running
environment, and all of the following must be true in the pull request:

1. **Generated, not hand-written.** The migration was produced by
   `pnpm run migration:generate -- --name <kebab-case-description>` and
   compared against the entity diff to confirm it captures the intended change
   and nothing more. Hand-written migrations must carry an explicit note
   explaining why generation was not possible.

2. **`down()` is implemented and tested.** Every migration implements a
   `down()` method that reverses the schema effect of `up()`. The author
   confirms they have run the full local sequence:
   ```bash
   pnpm run migration:run
   pnpm run migration:revert
   pnpm run migration:run
   pnpm run migrate:status
   ```
   This is required, not optional. See [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md)
   for the full reversibility rules.

3. **No drift.** The CI `drift-check` job (`pnpm run migration:generate:check`)
   must pass, confirming that no entity changes exist without a corresponding
   migration.

4. **Backward compatibility.** The migration is safe for a zero-downtime
   deploy: the schema it produces is readable by the previous version of the
   application code, so old pods and new pods can run simultaneously during a
   rolling deploy. See [`SCHEMA_CHANGE.md`](SCHEMA_CHANGE.md) for the
   specific compatibility rules.

5. **No direct connection inside the migration.** The migration uses only the
   `queryRunner` passed to `up()` and `down()`; it never opens its own
   database connection. CI's `migrations:check` scans for violations.

6. **Scope is minimal.** The migration changes only what its description says.
   A migration PR is not the place for incidental refactors or unrelated schema
   tweaks.

7. **Performance impact is assessed.** For any migration that locks a table,
   rebuilds an index, or otherwise may degrade a live environment, the pull
   request body includes an estimate of expected lock duration and the
   mitigation (batching, concurrent index build, maintenance window). Consult
   [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) for the owner to loop in.

8. **Destructive or irreversible steps are declared.** If `down()` cannot
   fully reverse the change (dropped column, removed enum value, data
   transform), the pull request states exactly what cannot be reversed and
   why, and requires the stricter sign-off in the Approval section below.

9. **Security or data-classification impact is noted.** A migration that adds
   a column holding Confidential or Restricted data (per
   [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md)) or changes how
   personal data is stored states this in the pull request body, and the
   reviewer for that area (per
   [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md)) signs off.

The minimum CI gate is the `validate` job from `.github/workflows/ci.yml`
(lint, typecheck, build, migration checks) plus the `drift-check` job.

## Reversibility Rule

Every migration that merges must be reversible at the schema level. This is an
invariant, not a best-effort goal:

- `down()` is always implemented. A migration without `down()` is incomplete
  and must not merge.
- `down()` is idempotent — guarded with `IF EXISTS` / `IF NOT NULL` so a
  retried revert does not error.
- Where true reversal is impossible (a data-only migration, a dropped column
  whose data cannot be reconstructed), `down()` may be a documented no-op,
  but the pull request must explicitly state what is lost in a rollback.
- Applied migrations are never modified. A later change is made in a new,
  forward-fixing migration. Modifying a migration that has been applied to any
  shared environment is prohibited.

For the full procedure and sign-off required when executing a rollback, see
[`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md).

## Production-Apply Approval

Applying a migration to a production environment requires explicit approval
separate from the PR review that merges the code.

| Migration type | Required approvers before `pnpm run migration:run` on production |
|---|---|
| Standard migration | Affected service's primary owner (per [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md)) |
| Migration with irreversible step | Service owner **and** one additional maintainer |
| Migration with estimated table lock > 30 s | Service owner **and** on-call maintainer; maintenance window preferred |
| Security or data-classification migration | Service owner **and** area security reviewer |

**Approval is recorded** before execution — in a tracking issue, a deployment
checklist comment, or the CI deployment job's approval gate — so there is an
auditable record of who authorised the production apply and when.

**Staging first.** Every migration is applied to the staging environment and
smoke-tested before the production-apply approval is sought. A migration that
behaves unexpectedly in staging is investigated and, if necessary, fixed
forward in a new migration before production is touched.

**Emergency exception.** When a production incident requires an immediate
schema fix and the normal approvers are unreachable, any maintainer may
authorise the apply. The maintainer records the decision immediately and
obtains retroactive sign-off within one business day. A post-incident review
follows, as described in [`POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md).

## Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces
no runtime behaviour, no schema change, and no executable code, so it adds no
tests and requires none. When a future migration is added, it ships with:

- A CI proof that `down()` works (the `revert` CI job is the baseline; a
  module-level migration test is added where the module already maintains a
  migration test suite).
- Where the migration adds a Confidential or Restricted column, a unit test
  asserting the field does not appear in log output or error responses, per
  [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md).

Existing lint, typecheck, build, and test suites must continue to pass, and
the change is verified by the standard CI pipeline described in `CONTRIBUTING.md`.

## Review

This policy is reviewed whenever the migration tooling, transaction model, or
deployment process changes materially, or when a migration incident reveals a
gap in this process. Changes are proposed through the normal governance process
described in `Governance/README.md` and must touch only the `Governance/`
folder.

## Related Documents

- [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md) — rollback procedure and
  sign-off for migrations that have already been applied.
- [`SCHEMA_CHANGE.md`](SCHEMA_CHANGE.md) — schema design rules that apply
  within a migration.
- [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md) — classification rules
  for columns added or changed by a migration.
- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — configuration changes that
  accompany a schema change.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — who owns the service whose
  schema is being changed.
- [`POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md) — post-incident review for
  emergency production applies.
- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording for migrations that touch
  Confidential or Restricted data.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
