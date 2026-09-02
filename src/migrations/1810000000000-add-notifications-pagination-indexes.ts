import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1016 — Add pagination and ordering to NotificationsService.getNotifications
 *
 * Adds composite indexes to support bounded, newest-first pagination:
 *  - idx_notifications_user_created          — (userId, createdAt DESC) for paginated listing
 *  - idx_notifications_user_isread_created   — (userId, isRead, createdAt DESC) for unread filtering without full scan
 *  - idx_notifications_user_status_created   — (userId, status, createdAt DESC) for status filtering
 */
export class AddNotificationsPaginationIndexes1810000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications" ("userId", "createdAt" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_notifications_user_isread_created" ON "notifications" ("userId", "isRead", "createdAt" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_notifications_user_status_created" ON "notifications" ("userId", "status", "createdAt" DESC)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_notifications_user_status_created"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_notifications_user_isread_created"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_notifications_user_created"');
  }
}
