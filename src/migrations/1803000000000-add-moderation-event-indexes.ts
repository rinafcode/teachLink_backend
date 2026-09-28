import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1242 - Add database indexes to the moderation-event entity.
 *
 * Indexes added:
 *  - IDX_moderation_event_status    - filters by moderation outcome
 *  - IDX_moderation_event_timestamp - sorts analytics by newest event
 */
export class AddModerationEventIndexes1803000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_moderation_event_status" ON "moderation_event" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_moderation_event_timestamp" ON "moderation_event" ("timestamp")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_moderation_event_timestamp"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_moderation_event_status"');
  }
}
