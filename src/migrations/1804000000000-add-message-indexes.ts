import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds indexes to the `messages` table to cover the common query paths:
 *
 *  - "load conversation between two users"
 *      → WHERE "senderId" = $1 AND "recipientId" = $2
 *        or WHERE "recipientId" = $1 AND "senderId" = $2
 *      → ORDER BY "createdAt"
 *  - "lookup by sender" / "lookup by recipient"
 *      → WHERE "senderId" = $1
 *      → WHERE "recipientId" = $1
 *
 * The composite indexes on (senderId, recipientId, createdAt) and
 * (recipientId, senderId, createdAt) allow the conversation query to use
 * index-only scans and avoid a separate sort step.
 */
export class AddMessageIndexes1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_messages_senderId" ON "messages" ("senderId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_messages_recipientId" ON "messages" ("recipientId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_messages_sender_recipient_createdAt" ON "messages" ("senderId", "recipientId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_messages_recipient_sender_createdAt" ON "messages" ("recipientId", "senderId", "createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_messages_recipient_sender_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_messages_sender_recipient_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_messages_recipientId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_messages_senderId"');
  }
}
