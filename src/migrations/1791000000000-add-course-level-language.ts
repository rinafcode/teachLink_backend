import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #995 — `SearchFilters` has declared `level` and `language` since
 * search filtering was introduced, but neither was ever backed by a column
 * on `course`, so `SearchService.search()` silently ignored both filters.
 * Adds the columns (mirroring the nullable, indexed `category` column) so
 * the query builder can filter on them.
 */
export class AddCourseLevelLanguage1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "course" ADD COLUMN IF NOT EXISTS "level" varchar');
    await queryRunner.query('ALTER TABLE "course" ADD COLUMN IF NOT EXISTS "language" varchar');

    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_course_level" ON "course" ("level")');
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_course_language" ON "course" ("language")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_course_level"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_course_language"');
    await queryRunner.query('ALTER TABLE "course" DROP COLUMN IF EXISTS "level"');
    await queryRunner.query('ALTER TABLE "course" DROP COLUMN IF EXISTS "language"');
  }
}
