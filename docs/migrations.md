# Database Migration Guide

How to manage database schema changes safely.

---

## Overview

The TeachLink backend uses **TypeORM migrations** for schema management. Migration files are standard TypeORM `MigrationInterface` classes located in `src/migrations/`.

There are two mechanisms for schema updates:
 
1. **Explicit migration files** (all environments — controlled, versioned changes; default mechanism)
2. **TypeORM `synchronize`** (disabled by default across all environments; opt-in via `DATABASE_SYNCHRONIZE=true`)

---

## How migrations work

Migration files live in `src/migrations/` and follow the naming convention:

```
<TIMESTAMP>-<Description>.ts
```

Each file exports a class implementing `MigrationInterface` with two methods:

- `up(queryRunner)` — applies the schema change
- `down(queryRunner)` — reverses the schema change

Example (`src/migrations/1630000000000-CreateMessageTable.ts`):

```typescript
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateMessageTable1630000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'senderId', type: 'uuid', isNullable: false },
          { name: 'recipientId', type: 'uuid', isNullable: false },
          { name: 'content', type: 'text', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'readAt', type: 'timestamptz', isNullable: true },
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('messages');
  }
}
```

### Transaction behavior (important)

TypeORM's default `migrationsTransactionMode` is **`all`**: every migration in a run executes inside a **single shared transaction**. This gives atomic rollback, but it means:

> A migration **must use the `QueryRunner` passed to `up()` / `down()`** and must **never open its own connection** (e.g. `queryRunner.connection.createQueryRunner()` or `dataSource.createQueryRunner()`).

A freshly created query runner is a separate pooled connection that cannot see uncommitted tables/rows created by earlier migrations in the same run (`relation "X" does not exist` on fresh databases) and escapes the shared transaction, so its changes are not rolled back if a later migration fails. This was the root cause of the `fix-invoice-number-sequence` failure resolved in [#1195](https://github.com/rinafcode/teachLink_backend/pull/1195).

CI enforces this rule via [`scripts/validate-migrations.js`](../scripts/validate-migrations.js), which fails the build if any migration opens its own connection.

### Current migrations

| File                                                                    | Description                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| `1630000000000-CreateMessageTable.ts`                                   | Creates `messages` table with sender/recipient FKs  |
| `1680000000000-create-schema-version-and-change-tables.ts`              | Creates `schema_version` and `schema_change` tables |
| `1685000001000-add-currency-and-location-fields-to-users.ts`            | Adds currency/location to users                     |
| `1685000001001-add-currency-field-to-courses.ts`                        | Adds currency to courses                            |
| `1748600000000-add-course-bulk-operations.ts`                           | Adds course bulk operations support                 |
| `1748700000000-add-grading-system.ts`                                   | Adds grading system tables                          |
| `1748800000000-add-gamification-tiers.ts`                               | Adds gamification tier tables                       |
| `1762000000000-create-audit-log-table.ts`                               | Creates `audit_log` table                           |
| `AddTimezoneLocalePreferences.ts`                                       | Adds timezone/locale preferences                    |
| `src/achievements/migrations/1700000000000-CreateAchievementsSchema.ts` | Creates achievements schema                         |

---

## Running migrations

### Via HTTP API (server must be running)

```bash
# Start the server first
pnpm start:dev

# In another terminal, run pending migrations
curl -X POST http://localhost:3000/migrations/run

# Check migration status
curl http://localhost:3000/migrations
```

Or via npm scripts:

```bash
pnpm migrate:run      # Run all pending
pnpm migrate:status   # Check status
```

### Via TypeORM CLI (alternative)

```bash
# Build the project first
pnpm build

# Run migrations using TypeORM CLI
npx typeorm migration:run -d src/config/datasource.ts
```

---

## Development mode (synchronize)

By default, TypeORM's `synchronize` is **disabled (`false`)** across all environments, including development (`#1210`). Schema changes are managed strictly via migrations to prevent schema drift and avoid dropping migration-managed columns.

If you need temporary schema auto-generation for local prototyping, you can opt in via the environment variable:

```bash
DATABASE_SYNCHRONIZE=true pnpm start:dev
```

> **Important:** When `synchronize` is enabled, running explicit migrations may fight the schema or cause columns not declared in entity files to be dropped. For standard development workflows, keep `DATABASE_SYNCHRONIZE=false` and run migrations via `pnpm migrate:run`.

---

## Rolling back migrations

### Roll back the last migration

```bash
curl -X POST http://localhost:3000/migrations/rollback
# or
pnpm migrate:rollback
```

### Roll back multiple migrations

```bash
# Roll back last 3
curl -X POST http://localhost:3000/migrations/rollback/3
# or
COUNT=3 pnpm migrate:rollback:count
```

### Roll back to a specific version

```bash
curl -X POST http://localhost:3000/migrations/rollback/to/002-create-courses-table
# or
MIGRATION_NAME=002-create-courses-table pnpm migrate:rollback:to
```

### Reset all migrations (development only)

```bash
curl -X DELETE http://localhost:3000/migrations/reset
# or
pnpm migrate:reset
```

> ⚠️ **Never run reset in production.** It drops all managed tables.

---

## Creating a new migration

1. Create a new file in `src/migrations/`:

```bash
# Naming convention: <timestamp>-<kebab-case-description>.ts
touch src/migrations/$(date +%s%N | cut -b1-13)-add-bio-to-users.ts
```

2. Implement the migration class:

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBioToUsers<TIMESTAMP> implements MigrationInterface {
  name = 'AddBioToUsers<TIMESTAMP>';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({ name: 'bio', type: 'text', isNullable: true }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'bio');
  }
}
```

3. Build and run:

```bash
pnpm build
# Restart server or run migration
```

---

## Best practices

| Practice                                       | Why                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Always implement `down()`                      | Enables safe rollback; log loud warnings if data changes or extension dependencies are irreversible (#1207)     |
| Never modify an applied migration              | Create a new migration instead                                                                                |
| Test rollbacks locally                         | Run `up` → verify → `down` → verify                                                                           |
| Use `IF EXISTS` / `IF NOT NULL`                | Makes migrations idempotent                                                                                   |
| Never open your own connection in a migration  | Migrations share one transaction; a separate connection can't see uncommitted work and breaks atomic rollback |
| Backup database before staging/prod migrations | Safety net                                                                                                    |
| Keep migrations small and focused              | Easier to review and rollback                                                                                 |
| Use timestamp-based naming                     | Ensures deterministic ordering                                                                                |

---

## Common migration failures

| Error                                       | Cause                                               | Fix                                                 |
| ------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `relation already exists`                   | Table created by `synchronize` or a prior migration | Drop the table or disable `synchronize`             |
| `column "X" of relation "Y" already exists` | Duplicate migration                                 | Create a new migration to handle the state          |
| `Cannot roll back: later migrations depend` | Dependency chain                                    | Roll back later migrations first                    |
| `migration:run` returns 404                 | Migration endpoints not wired                       | Check if endpoints exist; ensure migrations are run |
| Foreign key violation during migration      | Data integrity issue                                | Clean data, then retry                              |

---

## Environment-specific settings

| Environment | `synchronize`                                         | Migrations                       |
| ----------- | ----------------------------------------------------- | -------------------------------- |
| Development | `false` (default; opt-in via `DATABASE_SYNCHRONIZE=true`) | Run migrations (`pnpm migrate:run`) |
| Test        | `false`                                               | Run before test suite            |
| Staging     | `false`                                               | Run after deployment             |
| Production  | `false`                                               | Run with backup                  |

---

## Seed data

Seed data is available for specific modules:

- **Achievements:** `src/achievements/achievements.seed.ts` — seed achievement definitions

To run seeds, execute the seed function (typically exposed via an API endpoint or called during module initialization).

---

## Related

- [Setup guide](./setup.md) — how to get the database running
- [Troubleshooting guide](./troubleshooting.md) — database connection issues
- [Database config](../src/config/database.config.ts) — connection settings
