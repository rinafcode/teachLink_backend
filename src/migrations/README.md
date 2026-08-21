# Database Migrations

This directory holds the TeachLink backend's **TypeORM migrations** — versioned,
ordered schema changes applied on top of the `BaselineSchema` migration.

> **Workflow guide:** [`docs/migrations.md`](../../docs/migrations.md) covers
> the full workflow — running, rolling back, drift checks, and troubleshooting.
> This README focuses on the one rule that most often breaks migrations:
> **transaction handling**.

---

## How migrations run

Migrations are executed with the TypeORM CLI against `src/config/datasource.ts`:

```bash
pnpm run migration:run      # apply all pending migrations
pnpm run migration:revert   # revert the last migration
```

Every migration file exports a class implementing `MigrationInterface` with an
`up(queryRunner)` and a `down(queryRunner)` method. See `docs/migrations.md`
for a full example.

---

## ⚠️ Transaction rule: use the passed `queryRunner`, never open your own connection

TypeORM's default `migrationsTransactionMode` is **`all`**: every migration in a
single run shares **one transaction**. This gives you atomicity — if any
migration fails, the whole run rolls back — but it comes with a hard constraint:

> **A migration must only use the `QueryRunner` passed to its `up()` / `down()`**
> **method. It must never open a new connection or query runner.**

### Why

`queryRunner.connection.createQueryRunner()` (or `dataSource.createQueryRunner()`)
opens a **separate pooled connection** that:

1. **Cannot see uncommitted changes** — tables, columns, and rows created by
   earlier migrations in the same run are not yet committed, so a fresh
   connection will fail with `relation "X" does not exist` when it reads them.
2. **Escapes the shared transaction** — anything done on that separate
   connection is committed independently and is **not rolled back** if a later
   migration fails, leaving the database in a half-migrated state.

This is exactly the failure fixed in [#1195](https://github.com/rinafcode/teachLink_backend/pull/1195):
`fix-invoice-number-sequence` originally opened its own connection to SELECT
from `invoices` — a table created by an earlier migration in the same run — and
crashed from scratch on every fresh database.

### Do / Don't

```typescript
// ✅ DO — use the queryRunner handed to the migration
export class DoThis implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE ...`);
    const rows = await queryRunner.query(`SELECT * FROM earlier_table`); // visible: same transaction
  }
}

// ❌ DON'T — opens a separate connection that can't see uncommitted work
export class DoNotDoThis implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const other = queryRunner.connection.createQueryRunner(); // separate pooled connection
    try {
      await other.query(`SELECT * FROM earlier_table`); // "relation does not exist" on fresh DBs
    } finally {
      await other.release();
    }
  }
}
```

### Enforced in CI

[`scripts/validate-migrations.js`](../../scripts/validate-migrations.js) scans
every migration file for `createQueryRunner()` and direct `.connection` access
and fails the build if found — the same footgun cannot silently come back.

---

## Writing a new migration

1. Create a file named `<13-digit-timestamp>-<kebab-case-description>.ts` in
   `src/migrations/`. The timestamp (e.g. `2026-08-20` → `1795219200000`) must
   be **higher than every existing migration** so it runs last.
2. Implement `up(queryRunner)` and `down(queryRunner)` using only the passed
   `queryRunner`.
3. Verify locally:

   ```bash
   pnpm run migration:run
   pnpm run migration:revert   # proves down() works
   pnpm run migration:run      # re-apply to leave the DB migrated
   ```

## Rules of thumb

| Rule                                                      | Why                                          |
| --------------------------------------------------------- | -------------------------------------------- |
| Always implement `down()`                                 | Enables safe rollback in CI and production   |
| Never modify an applied migration                         | Create a new migration instead               |
| Use the passed `queryRunner`, never `createQueryRunner()` | Migrations share one transaction (see above) |
| Prefer `IF EXISTS` / `IF NOT NULL`                        | Makes migrations idempotent                  |
| Keep migrations small and focused                         | Easier to review and roll back               |
| Use timestamp-based naming                                | Ensures deterministic ordering               |
