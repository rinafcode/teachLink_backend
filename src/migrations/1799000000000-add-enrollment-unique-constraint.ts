import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforce at most one active enrollment per (user, course) at the database
 * layer (issue #1343).
 *
 * ## Context
 *
 * `EnrollmentsService.enroll()` guarded against duplicate enrollments with an
 * application-level read-then-write (`findOne` → `create` → `save`). Under
 * concurrent requests both writers can pass the "already enrolled?" check and
 * both insert, producing duplicate active enrollments.
 *
 * The index below is **partial** (`WHERE "deletedAt" IS NULL`) because the
 * enrollment table soft-deletes rows via `deletedAt`. A plain unique index
 * would treat an unenrolled (soft-deleted) row as still enrolled and block
 * re-enrollment forever.
 *
 * Existing duplicate rows are removed first (keeping the earliest enrollment)
 * so the index can be created on live data.
 */
export class AddEnrollmentUniqueConstraint1799000000000 implements MigrationInterface {
  name = 'AddEnrollmentUniqueConstraint1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // De-duplicate any rows that raced in before the constraint existed.
    await queryRunner.query(`
      DELETE FROM enrollment
      WHERE "deletedAt" IS NULL
        AND id IN (
          SELECT id FROM (
            SELECT
              id,
              ROW_NUMBER() OVER (
                PARTITION BY user_id, course_id
                ORDER BY "enrolledAt" ASC, id ASC
              ) AS rn
            FROM enrollment
            WHERE "deletedAt" IS NULL
          ) ranked
          WHERE rn > 1
        )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_enrollments_active_user_course"
        ON enrollment (user_id, course_id)
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_enrollments_active_user_course"');
  }
}
