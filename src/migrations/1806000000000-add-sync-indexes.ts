import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1247 — Create the sync table (if missing) and add database indexes.
 *
 * The sync entity was introduced without a baseline-schema entry, so CI
 * databases that only run migrations hit `relation "sync" does not exist`.
 * This migration creates the table first, then adds the performance indexes.
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
    // --- enum types -------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."sync_operation_enum" AS ENUM ('create', 'update', 'delete');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."sync_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'conflict', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // --- table ------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync" (
        "id"            uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
        "entity_type"   varchar(128) NOT NULL,
        "entity_id"     varchar(128) NOT NULL,
        "operation"     "public"."sync_operation_enum" NOT NULL,
        "status"        "public"."sync_status_enum"    NOT NULL DEFAULT 'pending',
        "version"       integer      NOT NULL DEFAULT 1,
        "source_region" varchar(64)  NOT NULL,
        "target_region" varchar(64),
        "payload"       jsonb,
        "last_error"    text,
        "retry_count"   integer      NOT NULL DEFAULT 0,
        "max_retries"   integer      NOT NULL DEFAULT 3,
        "last_modified" timestamptz  NOT NULL,
        "next_retry_at" timestamptz,
        "rowVersion"    integer      NOT NULL DEFAULT 1,
        "created_at"    timestamptz  NOT NULL DEFAULT now(),
        "updated_at"    timestamptz  NOT NULL DEFAULT now()
      );
    `);

    // --- indexes ----------------------------------------------------------
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
    await queryRunner.query('DROP TABLE IF EXISTS "sync"');
    await queryRunner.query('DROP TYPE IF EXISTS "public"."sync_status_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "public"."sync_operation_enum"');
  }
}
