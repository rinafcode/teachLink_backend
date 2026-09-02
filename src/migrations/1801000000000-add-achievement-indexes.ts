import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAchievementIndexes1801000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_achievements_active_hidden_difficulty_createdAt" ON "achievements" ("isActive", "isHidden", "difficulty", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_achievements_type_active_hidden_difficulty" ON "achievements" ("type", "isActive", "isHidden", "difficulty")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_achievements_type_active_hidden_difficulty"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_achievements_active_hidden_difficulty_createdAt"',
    );
  }
}
