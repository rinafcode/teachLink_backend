import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueCourseVersionConstraint1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM course_versions cv1
      USING (
        SELECT id
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY course_id, "versionNumber"
                   ORDER BY "createdAt" DESC
                 ) AS rn
          FROM course_versions
        ) dup
        WHERE dup.rn > 1
      ) cv2
      WHERE cv1.id = cv2.id
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_course_versions_course_id_version_number"
      ON "course_versions" ("course_id", "versionNumber")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_course_versions_course_id_version_number"
    `);
  }
}
