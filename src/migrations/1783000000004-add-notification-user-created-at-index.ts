import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1016 — Composite index for paginated notification listing (newest-first).
 *
 * Supports `WHERE userId = $1 ORDER BY createdAt DESC` with skip/take pagination.
 * Optional `isRead` / `status` filters are applied as index predicates on userId.
 *
 * Old notifications are removed by `DataRetentionService.purgeNotifications()` using
 * `notificationRetentionDays`; this index keeps per-user reads bounded to retained rows.
 */
export class AddNotificationUserCreatedAtIndex1783000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_createdAt"
      ON "notifications" ("userId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_unread_createdAt"
      ON "notifications" ("userId", "createdAt" DESC)
      WHERE "isRead" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_notifications_userId_unread_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_notifications_userId_createdAt"');
  }
}
