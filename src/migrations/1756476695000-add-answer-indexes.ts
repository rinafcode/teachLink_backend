import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnswerIndexes1756476695000 implements MigrationInterface {
  name = 'AddAnswerIndexes1756476695000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Foreign-key / lookup column indexes for the "answer" table.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_answer_question_id" ON "answer" ("question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_answer_submission_id" ON "answer" ("submission_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_answer_created_at" ON "answer" ("created_at")`,
    );
    // Composite index for the common "answers for a submission, by question" lookup.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_answer_submission_id_question_id" ON "answer" ("submission_id", "question_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_answer_submission_id_question_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_answer_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_answer_submission_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_answer_question_id"`);
  }
}
