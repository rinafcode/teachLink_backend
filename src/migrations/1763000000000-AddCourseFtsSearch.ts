import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseFtsSearch1763000000000 implements MigrationInterface {
  name = 'AddCourseFtsSearch1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
      ) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_course_search_vector"
      ON "course" USING GIN ("search_vector")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_course_search_vector"');
    await queryRunner.query('ALTER TABLE "course" DROP COLUMN IF EXISTS "search_vector"');
  }
}
