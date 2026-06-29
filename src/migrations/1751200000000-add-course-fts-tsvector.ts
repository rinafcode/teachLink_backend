import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds PostgreSQL full-text search support to the `course` table.
 *
 * Changes:
 *  1. Adds `search_vector` — a `tsvector` GENERATED ALWAYS AS STORED column
 *     that combines the title (weight A) and description (weight B) using the
 *     English text search configuration.  PostgreSQL automatically keeps the
 *     column in sync whenever a row is inserted or updated, so no triggers are
 *     required.
 *
 *  2. Creates a GIN index `IDX_course_search_vector` on the generated column.
 *     GIN (Generalized Inverted Index) is the canonical index type for
 *     tsvector columns and enables sub-millisecond @@ lookups even on tables
 *     with millions of rows.
 *
 * Requires PostgreSQL ≥ 12 (generated stored columns).
 *
 * Performance expectation:
 *   Before: ILIKE '%query%' → sequential scan, O(n) per request.
 *   After:  search_vector @@ plainto_tsquery(...) → GIN bitmap scan, O(log n + k).
 */
export class AddCourseFtsTsvector1751200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the tsvector generated column.
    //    - setweight('A') on title gives it higher relevance rank than
    //      description (weight 'B').
    //    - coalesce() prevents NULL from crashing the expression.
    //    - The column is STORED: computed once on write, not on every read.
    await queryRunner.query(`
      ALTER TABLE "course"
        ADD COLUMN IF NOT EXISTS "search_vector" tsvector
        GENERATED ALWAYS AS (
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'B')
        ) STORED
    `);

    // 2. Create the GIN index.  IF NOT EXISTS makes the migration idempotent.
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
