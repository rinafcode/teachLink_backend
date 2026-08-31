import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds indexes to the `segments` table for the common list and lookup paths:
 *
 *  - `name` lookup / search
 *  - `isDynamic` + `createdAt` for active/dynamic segment listings ordered by newest first
 *  - `deletedAt IS NULL` for soft-delete filtering while retaining an efficient active-only index
 *
 * These cover the primary query paths without introducing redundant single-column indexes
 * on the already-prefixed composite `isDynamic, createdAt` index.
 */
export class AddSegmentIndexes1806000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_segments_name" ON "segments" ("name")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_segments_isDynamic_createdAt" ON "segments" ("isDynamic", "createdAt")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_segments_deletedAt" ON "segments" ("deletedAt") WHERE "deletedAt" IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_segments_deletedAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_segments_isDynamic_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_segments_name"');
  }
}
