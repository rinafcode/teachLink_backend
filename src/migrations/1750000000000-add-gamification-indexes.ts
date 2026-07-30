import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGamificationIndexes1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_point_transactions_user_createdAt" ON "point_transactions" ("userId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_point_transactions_activityType" ON "point_transactions" ("activityType")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_user_challenges_user_challenge" ON "user_challenges" ("userId", "challengeId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_challenges_type" ON "challenges" ("type")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_tier_rewards_tier" ON "tier_rewards" ("tier")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_tier_rewards_tier"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_challenges_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_challenges_user_challenge"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_point_transactions_activityType"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_point_transactions_user_createdAt"');
  }
}
