import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #1229 — assessment_attempt has no indexes beyond the primary key.
 *
 * Common query paths that need coverage:
 *  - "list my attempts"  → WHERE "studentId" = $1
 *  - "attempts for assessment" → WHERE "assessmentId" = $1 (FK column)
 *  - "filter by status"  → WHERE status = $1
 *  - "has student started this assessment?" → WHERE "studentId" = $1 AND "assessmentId" = $2
 */
export class AddAssessmentAttemptIndexes1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_assessment_attempt_studentId" ON "assessment_attempt" ("studentId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_assessment_attempt_assessmentId" ON "assessment_attempt" ("assessmentId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_assessment_attempt_status" ON "assessment_attempt" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_assessment_attempt_studentId_assessmentId" ON "assessment_attempt" ("studentId", "assessmentId")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_assessment_attempt_studentId_assessmentId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_assessment_attempt_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_assessment_attempt_assessmentId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_assessment_attempt_studentId"');
  }
}
