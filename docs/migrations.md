# Database Migration Guide

How to manage database schema changes safely.

---

## Overview

The TeachLink backend uses **TypeORM migrations** for schema management. Migration files are standard TypeORM `MigrationInterface` classes located in `src/migrations/`.

There are two mechanisms for schema updates:

1. **TypeORM `synchronize`** (development only — auto-creates tables from entities)
2. **Explicit migration files** (all environments — controlled, versioned changes)

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
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
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

### Current migrations

| File | Description |
|------|-------------|
| `1630000000000-CreateMessageTable.ts` | Creates `messages` table with sender/recipient FKs |
| `1680000000000-create-schema-version-and-change-tables.ts` | Creates `schema_version` and `schema_change` tables |
| `1685000001000-add-currency-and-location-fields-to-users.ts` | Adds currency/location to users |
| `1685000001001-add-currency-field-to-courses.ts` | Adds currency to courses |
| `1748600000000-add-course-bulk-operations.ts` | Adds course bulk operations support |
| `1748700000000-add-grading-system.ts` | Adds grading system tables |
| `1748800000000-add-gamification-tiers.ts` | Adds gamification tier tables |
| `1762000000000-create-audit-log-table.ts` | Creates `audit_log` table |
| `AddTimezoneLocalePreferences.ts` | Adds timezone/locale preferences |
| `src/achievements/migrations/1700000000000-CreateAchievementsSchema.ts` | Creates achievements schema |

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
npx typeorm-ts-node-commonjs migration:run -d src/config/datasource.ts
```

---

## Development mode (synchronize)

In development (`NODE_ENV=development`), TypeORM's `synchronize: true` is enabled. This means:

- Tables are **auto-created** from entity definitions on server startup
- You do NOT need to run migrations for schema changes during active development
- This is fast for prototyping but provides no version tracking

> **Important:** When `synchronize` is on, running explicit migrations may fail with "relation already exists" because tables are already created. In that case, either:
> - Disable synchronize (`NODE_ENV=production` or edit `database.config.ts`)
> - Drop tables first, then run migrations

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

| Practice | Why |
|----------|-----|
| Always implement `down()` | Enables safe rollback |
| Never modify an applied migration | Create a new migration instead |
| Test rollbacks locally | Run `up` → verify → `down` → verify |
| Use `IF EXISTS` / `IF NOT NULL` | Makes migrations idempotent |
| Backup database before staging/prod migrations | Safety net |
| Keep migrations small and focused | Easier to review and rollback |
| Use timestamp-based naming | Ensures deterministic ordering |

---

## Common migration failures

| Error | Cause | Fix |
|-------|-------|-----|
| `relation already exists` | Table created by `synchronize` or a prior migration | Drop the table or disable `synchronize` |
| `column "X" of relation "Y" already exists` | Duplicate migration | Create a new migration to handle the state |
| `Cannot roll back: later migrations depend` | Dependency chain | Roll back later migrations first |
| `migration:run` returns 404 | Migration endpoints not wired | Check if endpoints exist; use `synchronize` for dev |
| Foreign key violation during migration | Data integrity issue | Clean data, then retry |

---

## Environment-specific settings

| Environment | `synchronize` | Migrations |
|-------------|---------------|------------|
| Development | `true` (default) | Optional (synchronize handles schema) |
| Test | `true` | Run before test suite |
| Staging | `false` | Run manually after deployment |
| Production | `false` | Run manually with backup |

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
