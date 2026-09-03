import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1238 — Add database indexes to the schema_change entity.
 *
 * Common access patterns for this table are:
 *  - filtering by schema name and ordering by recent change time
 *  - joining on the owning schema_version record
 *  - filtering by changeType
 */
export class AddSchemaChangeIndexes1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_schema_change_schema_name_created_at" ON "schema_change" ("schemaName", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_schema_change_schema_version_created_at" ON "schema_change" ("schemaVersionId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_schema_change_change_type" ON "schema_change" ("changeType")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_schema_change_change_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_schema_change_schema_version_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_schema_change_schema_name_created_at"');
  }
}
