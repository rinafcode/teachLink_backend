import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add indexes to the `review_item` table for common query paths:
 *
 *  - `status` for filtering by pending/reviewed state (getQueue WHERE clause)
 *  - `safetyScore, createdAt` composite for prioritised queue ordering
 *  - `sourceType`, `sourceId`, `reportId` for source-lookup joins and filters
 *
 * These cover the primary query paths without introducing redundant
 * single-column indexes that are already covered by the composite index.
 */
export class AddReviewItemIndexes1807000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_review_items_status" ON "review_item" ("status")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_review_items_safetyScore_createdAt" ON "review_item" ("safetyScore", "createdAt")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_review_items_sourceType" ON "review_item" ("sourceType")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_review_items_sourceId" ON "review_item" ("sourceId")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_review_items_reportId" ON "review_item" ("reportId")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_review_items_reportId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_review_items_sourceId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_review_items_sourceType"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_review_items_safetyScore_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_review_items_status"');
  }
}
