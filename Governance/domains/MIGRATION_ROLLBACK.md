# Migration Rollback Governance Policy

This document governs how database schema migrations in the TeachLink Backend
project are rolled back: when a rollback is required, how a migration's
`down()` is proven before merge, and who must sign off before a rollback is
executed. It exists so that a failed or harmful migration can be reversed by
following a single, versioned reference instead of improvising under incident
pressure.

This policy is part of the project's **Releases & change** and
**Security & disclosure** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Scope

A **schema migration** is a versioned, ordered change to the database schema
applied by TypeORM and recorded in the `migrations` table:

- Migrations under `src/migrations/` (the primary location, applied against
  `src/config/datasource.ts`), named
  `<13-digit-timestamp>-<kebab-case-description>.ts`.
- Migrations that live inside a feature module and follow the same
  `MigrationInterface` convention (`src/achievements/migrations/`,
  `src/notifications/migrations/`).

This policy covers both the **reversibility guarantee** of a migration (its
`down()` method) and the **rollback operation** that applies it — the
`pnpm run migration:revert` command (also exposed as `pnpm migrate:rollback`)
and the CI revert job that exercises it. Rolling back multiple migrations
means running revert once per migration, newest first, since TypeORM reverts
exactly one migration per invocation. Shard migration rollback plans
(`src/sharding/migration/shard-migration.service.ts`) follow this policy for
their reversibility rules and are additionally validated by the sharding
service before execution.

Out of scope — these are *not* schema migrations and are governed elsewhere:

- Application-level data and business-logic reversal, such as restoring a
  course to a prior version (`rollbackToVersion`) or a transaction rollback
  in `src/common/database/transaction-helper.service.ts`.
- Incident auto-remediation rollback
  (`src/incident-management/services/auto-remediation.service.ts`) and canary
  deployment rollback (`src/canary/`), which are governed by the incident and
  release processes respectively.

## Rollback Triggers

A rollback is either **automatic** or **operator-initiated**. Every
operator-initiated rollback is recorded as an incident (see Sign-off below).

### Automatic (no human decision required)

- **Failed migration run.** TypeORM's default `migrationsTransactionMode` is
  `all`: every migration in a run shares one transaction, so if any migration
  in the run fails the entire run is rolled back atomically. No partial schema
  change is committed.
- **Partial shard failure.** The shard-aware query runner rolls back every
  shard transaction when any shard in the operation fails
  (`src/common/database/sharding/runner/shard-aware-query-runner.ts`), so a
  sharded migration never completes halfway.
- **Pre-merge CI.** The `revert` CI job runs `pnpm run migration:revert` after
  applying migrations, so a migration whose `down()` is broken cannot merge.
  The `drift-check` job fails the build when entity changes have no matching
  migration.

### Operator-initiated (a rollback must be triggered)

A rollback is required, not optional, when any of the following is observed
after a migration has been applied:

1. **Deploy or boot failure** directly attributable to the migration (the
   service fails to start, or startup schema checks fail).
2. **Data corruption or integrity violation** — wrong data written, a
   constraint applied inconsistently, or referential integrity broken.
3. **Availability degradation** — the migration holds locks, runs far longer
   than expected, or otherwise degrades a live environment, and the condition
   does not clear promptly.
4. **Security or compliance breach** — the migration exposed data, wrote it in
   the wrong form (for example a token that should have been hashed), or
   otherwise violates a policy in `Governance/domains/AUDIT_LOG.md` or the
   data-sharing limits in `Governance/domains/THIRD_PARTY_INTEGRATION.md`.
5. **Schema drift** — the applied schema is confirmed to diverge from the
   entity definitions in a way that the migration caused rather than repaired.
6. **Out-of-order or wrong-environment application** — a migration was applied
   to an environment it was not intended for, or applied behind a migration it
   should have followed.

A rollback may also be *discretionary* (a performance regression, or a
follow-up migration that supersedes the change), in which case it follows the
same sign-off as a trigger-driven rollback but is not an incident.

The following are **not** rollback triggers, and reverting in response to them
is discouraged because it can make the state worse:

- A migration that completed but produced a slightly different (still valid)
  schema than a reviewer expected — fix forward instead.
- A failed migration run that already rolled back automatically — there is
  nothing left to revert; investigate and fix forward.

## The Tested-Down Migration Rule

1. **Every migration implements `down()`.** `down()` must reverse the schema
   effect of `up()` at the schema level, so the migration can be reverted in
   CI and in production. A migration without a `down()` method is incomplete
   and must not merge.
2. **`down()` is proven before merge.** The author runs the sequence locally
   against a real database, matching what CI does:

   ```bash
   pnpm run migration:run      # apply
   pnpm run migration:revert   # proves down() works
   pnpm run migration:run      # re-apply to leave the DB migrated
   pnpm run migrate:status     # confirm the expected migration is the latest
   ```

   The CI `revert` job is the enforcement point: a migration whose `down()`
   throws or leaves the schema inconsistent fails the build.
3. **`down()` is written to be re-runnable.** Use `IF EXISTS` / `IF NOT NULL`
   guards and the passed `queryRunner` only (a migration must never open its
   own connection — CI's `migrations:check` scans for this). `down()` is
   idempotent, so a retried revert does not error.
4. **Irreversible migrations are declared, not hidden.** Where `down()` cannot
   restore prior state — a dropped column, a removed enum value, a data
   transform, or a migration that intentionally leaves an object in place —
   `down()` may be a documented no-op, but the pull request must state exactly
   what cannot be reversed and why. Existing precedents to follow:
   - `1783000000006-clear-legacy-bcrypt-refresh-tokens.ts` — a data-only
     migration with an explicitly documented no-op `down()`.
   - `1600000000000-enable-uuid-ossp.ts` — leaves the extension in place
     because dropping it during a rollback is unsafe.
   - `1791000000001-fix-forum-anonymous-author.ts` — `down()` reverses the
     schema change but documents the data it cannot reconstruct.

   A migration with an irreversible step requires the stricter sign-off in the
   next section and must be paired with a database backup before it is applied
   outside development (see `docs/runbook.md`).
5. **Applied migrations are never modified.** Once a migration has been
   applied to any shared environment, it is immutable; a later change is made
   in a new, forward-fixing migration. This matches the audit-log
   immutability principle in `Governance/domains/AUDIT_LOG.md`.

## Rollback Procedure

When a trigger fires, a rollback is executed as follows. In an active
incident, the incident commander directs the sequence but does not waive the
sign-off requirement below.

1. **Announce and freeze.** State that a rollback is in progress so concurrent
   deploys and migration runs are paused. Do not apply new migrations while a
   rollback is under way.
2. **Back up first.** Take a database backup or snapshot before reverting, per
   `docs/runbook.md`. This is mandatory for any migration with an irreversible
   step (Tested-Down Rule, item 4).
3. **Revert the minimum.** Run `pnpm run migration:revert` once per migration
   to be reversed, newest first, stopping as soon as the harmful migration is
   undone. Never reset or drop the whole schema outside development — there is
   no `migration:reset` script in this project by design.
4. **Verify.** Confirm with `pnpm run migrate:status` that the expected
   migration is the new latest, run the drift check
   (`pnpm run migration:generate:check`), and smoke-test the affected service.
5. **If `down()` cannot reverse the change, restore from the backup** taken in
   step 2 and re-apply the migrations that should remain. This is the only
   correct path for an irreversible migration — do not attempt to hand-write a
   compensating reverse operation under pressure.
6. **Record.** File the incident (or, for a discretionary rollback, a tracking
   issue) with the trigger, the migration reverted, the outcome, and the
   follow-up fix. The migration that caused the rollback is not re-applied
   unchanged; it is fixed forward in a new migration.

## Sign-off

Sign-off has two distinct points. The person who authored the migration may be
a reviewer at neither point.

### Before merge (the migration itself)

- **Standard migration.** At least one reviewer confirms that `down()` exists
  and that the author followed the Tested-Down Migration Rule. For a migration
  that changes a service's schema, the affected service's primary owner (per
  `Governance/domains/SERVICE_OWNERSHIP.md`) is the required approver.
- **Destructive or irreversible migration.** Requires the service owner's
  approval **and** a second maintainer's approval, and the pull request must
  carry the explicit "what cannot be reversed" statement from the Tested-Down
  Rule. A migration with an undocumented `down()` no-op is rejected.

### Before execution (the rollback operation)

- **Staging.** A maintainer or the affected service's owner may execute a
  rollback; no incident is required for a discretionary staging rollback, but
  it is recorded in the tracking issue.
- **Production, planned (discretionary).** Requires sign-off from the affected
  service's primary owner and one maintainer, recorded before execution.
- **Production, incident-driven.** Requires sign-off from the affected
  service's primary owner and the incident commander, and the rollback is
  recorded as an incident in `src/incident-management/`. If the service owner
  is unreachable, escalation proceeds per
  `Governance/domains/SERVICE_OWNERSHIP.md`.
- **Emergency exception.** To restore service when an approver cannot be
  reached, any maintainer may execute an emergency rollback without prior
  sign-off. The maintainer must record the rollback immediately and obtain
  retroactive sign-off within one business day, and a post-incident review
  follows. The emergency exception is not a standing shortcut.

## Regression Tests

- **Migrations.** Where a module has migration tests, a migration that changes
  schema ships with a regression test covering its `down()` path, so a future
  change cannot silently break reversibility. The CI `revert` job is the
  baseline guarantee for every migration; module-level tests are in addition
  to it, not a replacement.
- **A rollback that exposes a test gap** opens a follow-up issue rather than
  being patched in place after the fact, so the gap is visible.
- **This document.** This is a Governance-only, documentation-only change: it
  introduces no runtime behaviour, no schema change, and no executable code,
  so it adds no tests and requires none. Existing lint, typecheck, build, and
  test suites must continue to pass, and the change is verified by the
  standard CI pipeline described in `CONTRIBUTING.md` §10.

## Review

This policy is reviewed whenever the migration tooling, transaction model, or
rollback command changes materially, or when a rollback reveals a gap in this
process. Changes are proposed through the normal governance process described
in `Governance/README.md` and must touch only the `Governance/` folder.
