import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables the `uuid-ossp` extension before any table is created.
 *
 * Several early migrations declare `id uuid NOT NULL DEFAULT uuid_generate_v4()`
 * (CreateMessageTable, add-course-bulk-operations, add-grading-system,
 * add-gamification-tiers, create-audit-log-table). On a fresh database the
 * function does not exist until the extension is enabled, which made
 * `migration:run` fail with `function uuid_generate_v4() does not exist`.
 *
 * The timestamp is intentionally the lowest of all migrations so this runs
 * first. `IF NOT EXISTS` keeps it idempotent on databases where the extension
 * is already present.
 */
export class EnableUuidOssp1600000000000 implements MigrationInterface {
  name = 'EnableUuidOssp1600000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  }

  public async down(_queryRunner?: QueryRunner): Promise<void> {
    // No-op: other schema objects depend on this extension, so dropping it
    // during a rollback could break the database. Leaving it in place is safe.
    console.warn(
      'WARNING: [EnableUuidOssp1600000000000] down() is a no-op. ' +
        'The "uuid-ossp" extension is retained because other database objects depend on it.',
    );
  }
}
