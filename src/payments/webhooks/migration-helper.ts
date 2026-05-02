/**
 * Database Migration Helper for Webhook Retries Table
 *
 * This file provides SQL for creating the webhook_retries table.
 * Use this if you need to manually create the table in production
 * or if TypeORM synchronization is disabled.
 *
 * Run this migration using:
 * - Raw SQL in your database management tool
 * - TypeORM migration runner
 * - Your custom migration system
 */
// SQL Migration for PostgreSQL
export const createWebhookRetriesTableSQL = `
-- Create ENUM types if they don't exist
DO $$ BEGIN
  CREATE TYPE webhook_status AS ENUM('pending', 'processing', 'succeeded', 'failed', 'dead_letter');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE webhook_provider AS ENUM('stripe', 'paypal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create webhook_retries table
CREATE TABLE IF NOT EXISTS webhook_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider webhook_provider NOT NULL,
  "externalEventId" VARCHAR NOT NULL,
  status webhook_status NOT NULL DEFAULT 'pending',
  payload JSONB,
  signature TEXT,
  "retryCount" INT NOT NULL DEFAULT 0,
  "maxRetries" INT NOT NULL DEFAULT 3,
  "nextRetryTime" TIMESTAMP,
  "lastError" TEXT,
  "errorDetails" JSONB,
  headers JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP
);

-- Create indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_provider_event 
  ON webhook_retries(provider, "externalEventId");

CREATE INDEX IF NOT EXISTS idx_webhook_status_retry 
  ON webhook_retries(status, "nextRetryTime") 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_webhook_created 
  ON webhook_retries("createdAt");

CREATE INDEX IF NOT EXISTS idx_webhook_dead_letter 
  ON webhook_retries("createdAt") 
  WHERE status = 'dead_letter';
`;
// TypeORM Migration Template
export const typeOrmMigrationTemplate = `
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookRetriesTable1681234567890 implements MigrationInterface {
  name = 'CreateWebhookRetriesTable1681234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(\`
      CREATE TYPE "public"."webhook_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'dead_letter')
    \`);

    await queryRunner.query(\`
      CREATE TYPE "public"."webhook_provider" AS ENUM('stripe', 'paypal')
    \`);

    // Create table
    await queryRunner.query(\`
      CREATE TABLE "webhook_retries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" "public"."webhook_provider" NOT NULL,
        "externalEventId" character varying NOT NULL,
        "status" "public"."webhook_status" NOT NULL DEFAULT 'pending',
        "payload" jsonb,
        "signature" text,
        "retryCount" integer NOT NULL DEFAULT 0,
        "maxRetries" integer NOT NULL DEFAULT 3,
        "nextRetryTime" TIMESTAMP,
        "lastError" text,
        "errorDetails" jsonb,
        "headers" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMP
      )
    \`);

    // Create indexes
    await queryRunner.query(\`
      CREATE UNIQUE INDEX "idx_webhook_provider_event" 
      ON "webhook_retries" ("provider", "externalEventId")
    \`);

    await queryRunner.query(\`
      CREATE INDEX "idx_webhook_status_retry" 
      ON "webhook_retries" ("status", "nextRetryTime")
      WHERE "status" IN ('pending', 'processing')
    \`);

    await queryRunner.query(\`
      CREATE INDEX "idx_webhook_created" 
      ON "webhook_retries" ("createdAt")
    \`);

    await queryRunner.query(\`
      CREATE INDEX "idx_webhook_dead_letter" 
      ON "webhook_retries" ("createdAt")
      WHERE "status" = 'dead_letter'
    \`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`DROP TABLE "webhook_retries"\`);
    await queryRunner.query(\`DROP TYPE "public"."webhook_provider"\`);
    await queryRunner.query(\`DROP TYPE "public"."webhook_status"\`);
  }
}
`;
// Database cleanup and maintenance queries
export const maintenanceQueries = {
    // Get dead letter queue stats
    getDeadLetterStats: `
    SELECT 
      COUNT(*) as total_dead_letters,
      COUNT(DISTINCT provider) as providers,
      MAX("createdAt") as oldest_entry,
      MIN("createdAt") as newest_entry
    FROM webhook_retries
    WHERE status = 'dead_letter';
  `,
    // Get retry statistics
    getRetryStats: `
    SELECT 
      status,
      COUNT(*) as count,
      AVG("retryCount") as avg_retries,
      MAX("retryCount") as max_retries,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "retryCount") as median_retries
    FROM webhook_retries
    GROUP BY status;
  `,
    // Get webhooks pending processing
    getPending: `
    SELECT id, provider, "externalEventId", "nextRetryTime", "retryCount"
    FROM webhook_retries
    WHERE status = 'pending'
    AND ("nextRetryTime" IS NULL OR "nextRetryTime" <= NOW())
    ORDER BY "nextRetryTime" ASC
    LIMIT 100;
  `,
    // Archive old succeeded webhooks (cleanup)
    archiveSuccessful: `
    DELETE FROM webhook_retries
    WHERE status = 'succeeded'
    AND "processedAt" < NOW() - INTERVAL '30 days';
  `,
    // Archive old dead letter webhooks (after review period)
    archiveDeadLetter: `
    DELETE FROM webhook_retries
    WHERE status = 'dead_letter'
    AND "createdAt" < NOW() - INTERVAL '90 days';
  `,
};
