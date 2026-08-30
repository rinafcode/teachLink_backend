import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1241 — Add database indexes to the migration entity.
 *
 * The `migrations` table is TypeORM's internal bookkeeping table. It is
 * queried by `name` (to check whether a migration has already been applied)
 * and ordered by `timestamp` (to determine the next pending migration).
 *
 * Indexes added:
 *  - IDX_migrations_name      — per-name lookup on every migration:run/revert
 *  - IDX_migrations_timestamp — ordering by timestamp to find pending migrations
 */
export class AddMigrationIndexes1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_migrations_name" ON "migrations" ("name")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_migrations_timestamp" ON "migrations" ("timestamp")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_migrations_timestamp"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_migrations_name"');
  }
}
