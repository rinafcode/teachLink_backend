import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds indexes to the `segment_rules` table to cover the common query paths:
 *
 *  - "load all rules for a segment"
 *      → WHERE "segmentId" = $1
 *  - "load rules for a segment ordered by position"
 *      → WHERE "segmentId" = $1 ORDER BY "order"
 *  - soft-delete filtering
 *      → WHERE "deletedAt" IS NULL  (combined with any other predicate)
 *
 * The enum columns `field` and `operator` are low-cardinality and are always
 * fetched as part of a segmentId lookup, so standalone indexes on them would
 * be redundant and add unnecessary write overhead.
 */
export class AddSegmentRuleIndexes1803000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Single-column FK index — satisfies all plain "rules for segment" lookups
    // and supports the ON DELETE CASCADE on segmentId.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_segment_rules_segmentId" ON "segment_rules" ("segmentId")`,
    );

    // Composite index — satisfies "rules for segment ordered by position" in a
    // single index scan with no extra sort step.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_segment_rules_segmentId_order" ON "segment_rules" ("segmentId", "order")`,
    );

    // Partial index on deletedAt — keeps soft-delete filtering cheap as the
    // table grows; only rows that have NOT been soft-deleted are indexed.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_segment_rules_deletedAt" ON "segment_rules" ("deletedAt") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_segment_rules_deletedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_segment_rules_segmentId_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_segment_rules_segmentId"`);
  }
}
