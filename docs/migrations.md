# Database Migration Guide

This document covers how to run, roll back, and manage database migrations in the teachLink backend.

## Overview

Migrations are managed by the custom `MigrationModule` built on top of TypeORM and NestJS. Every migration implements a `MigrationConfig` interface with two methods:

- `up(connection)` — applies the schema change
- `down(connection)` — fully reverses the schema change

All migrations are registered in `src/migrations/migration.registry.ts` and tracked in the `migrations` database table.

---

## Migration Files

Migration files live in `src/migrations/samples/` and follow the naming convention:

```
NNN-description-of-change.migration.ts
```

Where `NNN` is a zero-padded sequence number (e.g. `001`, `002`). This ensures a deterministic execution order.

### Current Migrations

| # | Name | Description |
|---|------|-------------|
| 006 | `006-create-migrations-tracking-table` | Creates the `migrations` tracking table |
| 001 | `001-create-users-table` | Creates the `users` table with roles, status, and indexes |
| 002 | `002-create-courses-table` | Creates the `course` table with FK to users |
| 003 | `003-create-course-modules-table` | Creates the `course_module` table |
| 004 | `004-create-lessons-table` | Creates the `lesson` table |
| 005 | `005-create-enrollments-table` | Creates the `enrollment` table |

---

## Running Migrations

### Via npm scripts (requires the app to be running)

```bash
# Run all pending migrations
npm run migrate:run

# Check status of all migrations
npm run migrate:status
```

### Via HTTP API directly

```bash
# Run all pending migrations
curl -X POST http://localhost:3000/migrations/run

# List all migrations and their status
curl http://localhost:3000/migrations
```

### Automatic on startup

Set the environment variable to run migrations automatically when the app boots:

```bash
AUTO_RUN_MIGRATIONS=true
```

---

## Rolling Back Migrations

### Roll back the last migration

```bash
npm run migrate:rollback
# or
curl -X POST http://localhost:3000/migrations/rollback
```

### Roll back the last N migrations

```bash
# Roll back last 3 migrations
COUNT=3 npm run migrate:rollback:count
# or
curl -X POST http://localhost:3000/migrations/rollback/3
```

### Roll back a specific named migration

```bash
curl -X PUT http://localhost:3000/migrations/002-create-courses-table/rollback
```

> **Note:** This will fail if later migrations that depend on this one are still applied. Roll those back first.

### Roll back to a specific version

Rolls back all migrations applied *after* the named migration, leaving the named migration itself in place.

```bash
MIGRATION_NAME=002-create-courses-table npm run migrate:rollback:to
# or
curl -X POST http://localhost:3000/migrations/rollback/to/002-create-courses-table
```

---

## Resetting All Migrations (Development Only)

This rolls back every applied migration in reverse order and clears the tracking table.

```bash
npm run migrate:reset
# or
curl -X DELETE http://localhost:3000/migrations/reset
```

> ⚠️ **Never run this in production.** It will drop all managed tables.

---

## Creating a New Migration

1. Create a new file in `src/migrations/samples/` following the naming convention:

```typescript
// src/migrations/samples/007-add-bio-to-users.migration.ts
import { Injectable, Logger } from '@nestjs/common';
import { MigrationConfig } from '../migration.service';

@Injectable()
export class AddBioToUsersMigration implements MigrationConfig {
  name = '007-add-bio-to-users';
  version = '1.0.0';
  dependencies = ['001-create-users-table'];

  private readonly logger = new Logger(AddBioToUsersMigration.name);

  async up(connection: any): Promise<void> {
    await connection.query(`ALTER TABLE users ADD COLUMN bio TEXT;`);
  }

  async down(connection: any): Promise<void> {
    await connection.query(`ALTER TABLE users DROP COLUMN IF EXISTS bio;`);
  }
}
```

2. Register it in `src/migrations/migration.registry.ts`:

```typescript
import { AddBioToUsersMigration } from './samples/007-add-bio-to-users.migration';

export const MIGRATION_REGISTRY: MigrationConfig[] = [
  // ... existing migrations ...
  new AddBioToUsersMigration(),
];
```

---

## Migration Best Practices

- **Always implement `down()`** as the exact inverse of `up()` — same columns, same types, same constraints, in reverse order.
- **Declare dependencies** in the `dependencies` array. The runner validates them before executing.
- **Never modify an existing migration** that has already been applied to any environment. Create a new migration instead.
- **Test rollbacks locally** before merging. Run `up`, verify, then run `down` and verify the schema is restored.
- **Use `IF EXISTS` / `IF NOT EXISTS`** guards in SQL to make migrations idempotent where possible.
- **Back up your database** before running migrations in staging or production.

---

## Environment-Specific Considerations

| Environment | `AUTO_RUN_MIGRATIONS` | Notes |
|-------------|----------------------|-------|
| Development | `true` (recommended) | Migrations run on every app start |
| Test | `false` | Use `migrate:run` before test suites |
| Staging | `false` | Run manually after deployment |
| Production | `false` | Run manually with a backup in place |

---

## Troubleshooting

**Migration stuck in `pending` status**
The migration was registered but never executed. Run `npm run migrate:run`.

**Migration stuck in `failed` status**
Check the `error_message` column in the `migrations` table. Fix the underlying issue, then either re-run or roll back.

**`Dependency not met` error**
A migration's dependency hasn't been applied yet. Check the registry order and run the dependency first.

**`Cannot roll back` error**
Later migrations that depend on this one are still applied. Roll those back first, then retry.
