import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1239 - Add database indexes to the schema_version entity.
 *
 * Indexes added:
 *  - IDX_schema_version_schemaName - lookups and filtering by schema name
 *  - IDX_schema_version_checksum - lookups and verification by content checksum
 *  - IDX_schema_version_createdAt - chronological ordering and range queries
 *  - IDX_schema_version_schemaName_createdAt - composite index for schema version history queries
 */
export class AddSchemaVersionIndexes1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_schema_version_schemaName" ON "schema_version" ("schemaName")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_schema_version_checksum" ON "schema_version" ("checksum")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_schema_version_createdAt" ON "schema_version" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_schema_version_schemaName_createdAt" ON "schema_version" ("schemaName", "createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_schema_version_schemaName_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_schema_version_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_schema_version_checksum"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_schema_version_schemaName"');
  }
}
