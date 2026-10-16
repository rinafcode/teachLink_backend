# Database Schema Change Policy

This document governs the design rules that apply when a database schema
change is introduced in the TeachLink Backend project: the backward-
compatibility rule that every schema change must satisfy, the review checklist
a pull request must pass before it merges, and the rollback requirement that
ensures every change can be reversed. It exists so that schema changes are
safe for zero-downtime deploys and can be undone without a production incident.

This policy is part of the project's **Releases & change** area. It lives
entirely inside the `Governance/` folder and does not change application code.

For the procedure that governs **authoring, reviewing, and approving** a
migration that implements a schema change, see
[`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md). For the
procedure that governs **rolling back** a schema change after it has been
applied, see [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md).

## Scope

A **schema change** is any addition, modification, or removal of a database
object that is managed by TypeORM migrations:

- Tables, columns, indexes, and constraints in any migration under
  `src/migrations/`, `src/achievements/migrations/`, or
  `src/notifications/migrations/`.
- Enum types and custom database types referenced by TypeORM entities.
- Views or stored procedures introduced or managed by a migration (rare, but
  in scope if present).

Out of scope:

- Application-level data changes that do not alter the schema (governed by
  [`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md) as data-only
  migrations).
- Configuration changes that happen to reference a database (governed by
  [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md)).

## Backward-Compatibility Rule

Every schema change that merges must be **backward-compatible** with the
version of the application code immediately before the change is deployed.
This is required to support zero-downtime rolling deploys in which old and new
pods run simultaneously.

A schema change is backward-compatible when the **old application code** can
read and write to the **new schema** without error. Concretely:

| Change type | Backward-compatible approach |
|---|---|
| Adding a column | Add as `NULL`able, or with a `DEFAULT` the old code can safely ignore. Never add `NOT NULL` without a default in the same migration. |
| Renaming a column | Expand–migrate–contract: add the new column, dual-write in the application, copy data, remove the old column in a later migration after all pods are on the new code. |
| Removing a column | Remove the application code that reads the column first, in a separate deploy, then drop the column in a subsequent migration. |
| Adding a constraint | Validate data compatibility before adding. A `NOT NULL` constraint on an existing column requires a data backfill migration first. |
| Changing a column type | Only widening conversions (e.g. `varchar(50)` → `varchar(255)`, `int` → `bigint`) are backward-compatible. Narrowing, re-typing, or removing precision requires expand–migrate–contract. |
| Adding a table | Always backward-compatible; old code ignores tables it does not reference. |
| Removing a table | Remove all application code that references the table first, in a prior deploy, then drop the table. |
| Adding an enum value | Always backward-compatible (old code ignores unknown values it does not read). |
| Removing an enum value | Remove all application code that produces or consumes the value first, then remove it from the enum in a subsequent migration. |
| Adding an index | Safe on a quiescent column; use a concurrent index build strategy for a large, live table to avoid lock escalation. |
| Removing an index | Always backward-compatible for correctness; note the performance impact in the PR body. |

A change that cannot be made backward-compatible in a single migration **must**
be split across multiple migrations and multiple deploys, following the
expand–migrate–contract pattern above. A single-step breaking change is
rejected at review.

## Review Checklist

Every schema-change pull request is reviewed against the following checklist
before it merges. The pull request body must address each item, or state
explicitly that the item does not apply and why.

- [ ] **Backward-compatibility confirmed.** The change type is identified
  (see the table above) and the backward-compatible approach has been
  followed. If expand–migrate–contract is required, the PR is part of a
  tracked sequence and references the preceding and following PRs.
- [ ] **`down()` implemented and proven.** The migration reverses the schema
  change at the schema level, and the author has run the local
  apply → revert → apply → status sequence (see
  [`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md)).
- [ ] **No drift.** `pnpm run migration:generate:check` passes; entity
  definitions and the schema are in sync after this migration.
- [ ] **Performance impact assessed.** For any change that may lock a table
  or rebuild an index on a live dataset, the PR body estimates the lock
  duration and states the mitigation.
- [ ] **Data classification noted.** If the change adds or modifies a column
  holding Confidential or Restricted data, the classification is stated in the
  PR body and the appropriate column-level JSDoc label is added (per
  [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md)).
- [ ] **Destructive or irreversible steps declared.** If `down()` cannot
  fully reverse the change, the PR body states exactly what is lost in a
  rollback and the stricter sign-off in
  [`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md) is obtained.
- [ ] **Scope is minimal.** The migration changes only what the PR description
  says; no unrelated schema tweaks are bundled.
- [ ] **CI gates pass.** The `validate` job and `drift-check` job in
  `.github/workflows/ci.yml` pass before the PR is approved.

## Rollback Requirement

Every schema change must ship with a functional rollback path. This is not
discretionary:

- `down()` is always implemented. A schema change without a working `down()`
  is incomplete and must not merge.
- The rollback path is stated in the pull request body: which `pnpm run
  migration:revert` steps are required and what the schema looks like
  afterwards.
- Where `down()` cannot restore prior state (a dropped column, a data
  transform, an irreversible type change), the PR body documents what cannot
  be recovered and a database backup is required before the migration is
  applied outside development, per `docs/runbook.md`.
- Applied migrations are never modified. If a schema change needs to be
  adjusted after it has been applied to any shared environment, the correction
  is made in a new, forward-fixing migration, not by editing the existing one.

For the full rollback procedure and sign-off requirements, see
[`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md).

## Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces
no runtime behaviour, no schema change, and no executable code, so it adds no
tests and requires none. When a future schema change is introduced, it ships
with:

- A CI proof that `down()` works (the `revert` CI job is the baseline).
- For a column holding Confidential or Restricted data, a unit test asserting
  the field does not appear in log output or error responses, per
  [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md).
- For an expand–migrate–contract sequence, an integration test confirming that
  the old and new code paths both function correctly against the intermediate
  schema state.

Existing lint, typecheck, build, and test suites must continue to pass, and
the change is verified by the standard CI pipeline described in `CONTRIBUTING.md`.

## Review

This policy is reviewed whenever the schema design conventions, TypeORM
version, or deploy strategy changes materially, or when a schema incident
reveals a gap. Changes are proposed through the normal governance process
described in `Governance/README.md` and must touch only the `Governance/`
folder.

## Related Documents

- [`DB_MIGRATION_GOVERNANCE.md`](DB_MIGRATION_GOVERNANCE.md) — authoring,
  reviewing, and approving migrations that implement schema changes.
- [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md) — rollback procedure for
  schema changes that have already been applied.
- [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md) — classification rules
  for columns added or changed by a schema migration.
- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — configuration changes that may
  accompany a schema change.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — who owns the service whose
  schema is being changed.
- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording for schema changes that
  touch Confidential or Restricted data.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
