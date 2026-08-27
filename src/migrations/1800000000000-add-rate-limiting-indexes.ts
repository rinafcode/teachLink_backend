import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1249 — Add database indexes to the rate-limiting entity.
 *
 * Indexes added:
 *  - IDX_rate_limiting_userId          — per-user lookup
 *  - IDX_rate_limiting_endpoint        — per-route filter
 *  - IDX_rate_limiting_userId_endpoint — composite for the most common query
 *  - IDX_rate_limiting_windowStart     — range/cleanup queries
 */
export class AddRateLimitingIndexes1800000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create table if it does not yet exist so this migration is safe to run
    // even before synchronize has been applied.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rate_limiting" (
        "id"           uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId"       character varying,
        "endpoint"     character varying,
        "windowStart"  TIMESTAMP,
        "requestCount" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_rate_limiting" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rate_limiting_userId" ON "rate_limiting" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rate_limiting_endpoint" ON "rate_limiting" ("endpoint")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rate_limiting_userId_endpoint" ON "rate_limiting" ("userId", "endpoint")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rate_limiting_windowStart" ON "rate_limiting" ("windowStart")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_limiting_windowStart"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_limiting_userId_endpoint"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_limiting_endpoint"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_limiting_userId"`);
  }
}
