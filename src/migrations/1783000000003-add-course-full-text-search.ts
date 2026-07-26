import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #814 — Add PostgreSQL full-text search support to the `course` table.
 *
 * ## Why
 *
 * `SearchService.search()` previously used `course.title ILIKE :query OR
 * course.description ILIKE :query` for keyword search. The leading wildcard
 * (`%query%`) prevents B-tree index use, causing PostgreSQL to perform a
 * sequential scan on every search request. At 100k rows the latency was
 * unacceptable.
 *
 * ## What
 *
 *   1. Adds a stored generated `tsvector` column `search_vector` that
 *      concatenates `title`, `description`, and `category` and runs them
 *      through the English text-search configuration.
 *   2. Creates a GIN index on `search_vector` — the canonical index type for
 *      tsvector equality / match queries (`@@`).
 *
 * The column is a `GENERATED ALWAYS AS … STORED` column. PostgreSQL keeps it
 * in sync with `title`/`description`/`category` on every UPDATE and INSERT
 * synchronously, so no application-side triggers are required. STORED (vs
 * VIRTUAL) is required because GIN indexes can only be built on persistent
 * (on-disk) columns.
 *
 * ## Rollback safety
 *
 * The generated column has no application-side dependencies. DROP COLUMN
 * cascades the index automatically. `down()` therefore removes both the
 * column and the explicit GIN index, in this order so the rollback doesn't
 * fail on databases where the column was never created.
 */
export class AddCourseFullTextSearch1783000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course"
        ADD COLUMN IF NOT EXISTS "search_vector" tsvector
        GENERATED ALWAYS AS (
          to_tsvector(
            'english',
            coalesce("title", '') || ' ' ||
            coalesce("description", '') || ' ' ||
            coalesce("category", '')
          )
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
