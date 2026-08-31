import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1247 — Add database indexes to the sync entity.
 *
 * Indexes added:
 *   IDX_sync_entity               — (entityType, entityId) lookups
 *   IDX_sync_status               — filter by sync status
 *   IDX_sync_last_modified        — ordered scans for recent changes
 *   IDX_sync_source_region_status — regional dashboard queries
 *   IDX_sync_version              — conflict-resolution comparisons
 */
export class AddSyncIndexes1806000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sync_entity"
       ON "sync" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sync_status"
       ON "sync" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sync_last_modified"
       ON "sync" ("last_modified")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sync_source_region_status"
       ON "sync" ("source_region", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sync_version"
       ON "sync" ("version")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_sync_version"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_sync_source_region_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_sync_last_modified"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_sync_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_sync_entity"');
  }
}
