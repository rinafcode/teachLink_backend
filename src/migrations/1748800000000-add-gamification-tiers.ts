import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Adds tier/level gamification support:
 *  - Creates `tier_rewards` table
 *  - Adds `tier` enum column to `user_progress`
 */
export class AddGamificationTiers1748800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tier enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tier_enum" AS ENUM (
          'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Add tier column to user_progress
    await queryRunner.query(`
      ALTER TABLE "user_progress"
        ADD COLUMN IF NOT EXISTS "tier" "tier_enum" NOT NULL DEFAULT 'BRONZE';
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_progress_tier"
        ON "user_progress" ("tier");
    `);

    // Create tier_rewards table
    await queryRunner.createTable(
      new Table({
        name: 'tier_rewards',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'version', type: 'integer', default: 1 },
          { name: 'tier', type: 'tier_enum', isUnique: true },
          { name: 'title', type: 'varchar' },
          { name: 'description', type: 'varchar' },
          { name: 'badgeId', type: 'varchar', isNullable: true },
          { name: 'bonusPoints', type: 'integer', default: 0 },
          { name: 'metadata', type: 'jsonb', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'tier_rewards',
      new TableIndex({ name: 'IDX_tier_rewards_tier', columnNames: ['tier'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tier_rewards', true);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_progress_tier";`);
    await queryRunner.query(`ALTER TABLE "user_progress" DROP COLUMN IF EXISTS "tier";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tier_enum";`);
  }
}
