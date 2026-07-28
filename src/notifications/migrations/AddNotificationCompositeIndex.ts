import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @deprecated Use src/migrations/1783000000004-add-notification-user-created-at-index.ts
 */
export class AddNotificationCompositeIndex1700000000000 implements MigrationInterface {
  name = 'AddNotificationCompositeIndex1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
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

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_notifications_userId_unread_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_notifications_userId_createdAt"');
  }
}
