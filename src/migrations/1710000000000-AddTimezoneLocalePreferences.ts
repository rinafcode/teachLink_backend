import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimezoneLocalePreferences1710000000000 implements MigrationInterface {
  name = 'AddTimezoneLocalePreferences1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "timezone" varchar DEFAULT 'UTC'
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "locale" varchar DEFAULT 'en-US'
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "currency" varchar DEFAULT 'USD'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP COLUMN IF EXISTS "currency"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP COLUMN IF EXISTS "locale"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_preferences"
      DROP COLUMN IF EXISTS "timezone"
    `);
  }
}
