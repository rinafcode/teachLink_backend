import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationContentHashIndex1710000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure pgcrypto extension exists for SHA256 hashing
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // 2. Add content_hash column
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN "content_hash" VARCHAR(64);`,
    );

    // 3. Backfill content_hash for existing rows
    await queryRunner.query(
      `UPDATE "notifications" SET "content_hash" = encode(digest("content", 'sha256'), 'hex') WHERE "content_hash" IS NULL;`,
    );

    // 4. Set column as NOT NULL
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "content_hash" SET NOT NULL;`,
    );

    // 5. Create composite deduplication index
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_dedup" ON "notifications" ("user_id", "type", "content_hash", "created_at" DESC);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index and column
    await queryRunner.query(`DROP INDEX "idx_notifications_dedup";`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN "content_hash";`,
    );
  }
}