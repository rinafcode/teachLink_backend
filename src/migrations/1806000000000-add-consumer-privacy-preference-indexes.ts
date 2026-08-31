import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1244 — Add database indexes to the consumer-privacy-preference entity.
 *
 * Common query paths that need coverage:
 *  - "get user preferences"               → WHERE "userId" = $1
 *  - "get tenant preferences list"        → WHERE "tenantId" = $1
 *  - "get specific user within tenant"    → WHERE "tenantId" = $1 AND "userId" = $2 (composite)
 *  - "users who opted out of data sale"   → WHERE "doNotSellMyPersonalInformation" = true
 *  - "recent CCPA requests"               → ORDER BY "lastCcpRequestDate" DESC / range queries
 *
 * Indexes added:
 *  - IDX_consumer_privacy_preferences_user_id              — per-user lookup (FK column)
 *  - IDX_consumer_privacy_preferences_tenant_id            — per-tenant filtering
 *  - IDX_consumer_privacy_preferences_tenant_user          — composite tenant+user (unique, covers most common multi-tenant query)
 *  - IDX_consumer_privacy_preferences_do_not_sell          — do-not-sell opt-out flag filtering
 *  - IDX_consumer_privacy_preferences_last_request_date    — last CCPA request sorting/range queries
 */
export class AddConsumerPrivacyPreferenceIndexes1806000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consumer_privacy_preferences" (
        "id"                                   uuid NOT NULL DEFAULT gen_random_uuid(),
        "version"                              integer NOT NULL DEFAULT 1,
        "tenantId"                             character varying,
        "userId"                               character varying NOT NULL,
        "doNotSellMyPersonalInformation"       boolean NOT NULL DEFAULT false,
        "optOutOfDataSharing"                  boolean NOT NULL DEFAULT false,
        "optOutOfMarketing"                    boolean NOT NULL DEFAULT false,
        "limitUseOfSensitivePersonalInformation" boolean NOT NULL DEFAULT false,
        "dataCategoryPreferences"              jsonb,
        "purposePreferences"                   jsonb,
        "lastCcpRequestDate"                   TIMESTAMP,
        "expiresAt"                            TIMESTAMP,
        "source"                               character varying,
        "identityVerified"                     boolean NOT NULL DEFAULT false,
        "verificationMethod"                   character varying,
        "notes"                                text,
        "createdAt"                            TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"                            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consumer_privacy_preferences" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_consumer_privacy_preferences_user_id" ON "consumer_privacy_preferences" ("userId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_consumer_privacy_preferences_tenant_id" ON "consumer_privacy_preferences" ("tenantId")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consumer_privacy_preferences_tenant_user" ON "consumer_privacy_preferences" ("tenantId", "userId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_consumer_privacy_preferences_do_not_sell" ON "consumer_privacy_preferences" ("doNotSellMyPersonalInformation")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_consumer_privacy_preferences_last_request_date" ON "consumer_privacy_preferences" ("lastCcpRequestDate")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_consumer_privacy_preferences_last_request_date"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_consumer_privacy_preferences_do_not_sell"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_consumer_privacy_preferences_tenant_user"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_consumer_privacy_preferences_tenant_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_consumer_privacy_preferences_user_id"');
  }
}
