import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

/**
 * Adds the rubric-based submission grading system:
 *  - `rubrics`            — top-level rubric metadata
 *  - `rubric_criteria`    — weighted criteria per rubric
 *  - `rubric_levels`      — discrete performance levels per criterion
 *  - `submission_grades`  — per-attempt grade aggregating criterion scores
 *  - `criterion_grades`   — per-criterion score within a submission grade
 *  - `feedback_templates` — reusable mustache-style feedback templates
 */
export class AddGradingSystem1748700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // -----------------------------------------------------------------
    // Enum used by submission_grades.status
    // -----------------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "submission_grades_status_enum" AS ENUM (
          'pending', 'graded', 'auto_graded'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // -----------------------------------------------------------------
    // rubrics
    // -----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'rubrics',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'owner_id', type: 'uuid', isNullable: true },
          { name: 'assessment_id', type: 'uuid', isNullable: true },
          {
            name: 'totalPoints',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          { name: 'autoGradeEnabled', type: 'boolean', default: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('rubrics', [
      new TableIndex({ name: 'IDX_rubrics_name', columnNames: ['name'] }),
      new TableIndex({ name: 'IDX_rubrics_owner', columnNames: ['owner_id'] }),
      new TableIndex({
        name: 'IDX_rubrics_assessment',
        columnNames: ['assessment_id'],
      }),
    ]);

    // -----------------------------------------------------------------
    // rubric_criteria
    // -----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'rubric_criteria',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'rubric_id', type: 'uuid', isNullable: false },
          { name: 'title', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'maxPoints',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          { name: 'orderIndex', type: 'int', default: 0 },
          { name: 'default_level_id', type: 'uuid', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'rubric_criteria',
      new TableIndex({
        name: 'IDX_rubric_criteria_rubric',
        columnNames: ['rubric_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'rubric_criteria',
      new TableForeignKey({
        name: 'FK_rubric_criteria_rubric',
        columnNames: ['rubric_id'],
        referencedTableName: 'rubrics',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // -----------------------------------------------------------------
    // rubric_levels
    // -----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'rubric_levels',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'criterion_id', type: 'uuid', isNullable: false },
          { name: 'label', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'points',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          { name: 'orderIndex', type: 'int', default: 0 },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'rubric_levels',
      new TableIndex({
        name: 'IDX_rubric_levels_criterion',
        columnNames: ['criterion_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'rubric_levels',
      new TableForeignKey({
        name: 'FK_rubric_levels_criterion',
        columnNames: ['criterion_id'],
        referencedTableName: 'rubric_criteria',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // -----------------------------------------------------------------
    // feedback_templates
    // -----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'feedback_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          { name: 'owner_id', type: 'uuid', isNullable: true },
          { name: 'isDefault', type: 'boolean', default: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('feedback_templates', [
      new TableIndex({
        name: 'IDX_feedback_templates_name',
        columnNames: ['name'],
      }),
      new TableIndex({
        name: 'IDX_feedback_templates_owner',
        columnNames: ['owner_id'],
      }),
    ]);

    // -----------------------------------------------------------------
    // submission_grades
    // -----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'submission_grades',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'attempt_id', type: 'uuid', isNullable: false },
          { name: 'rubric_id', type: 'uuid', isNullable: false },
          { name: 'grader_id', type: 'uuid', isNullable: true },
          {
            name: 'status',
            type: 'submission_grades_status_enum',
            default: "'pending'",
          },
          {
            name: 'totalScore',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'maxScore',
            type: 'numeric',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'percentage',
            type: 'numeric',
            precision: 5,
            scale: 2,
            default: 0,
          },
          { name: 'feedback', type: 'text', isNullable: true },
          { name: 'feedback_template_id', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('submission_grades', [
      new TableIndex({
        name: 'IDX_submission_grades_attempt',
        columnNames: ['attempt_id'],
      }),
      new TableIndex({
        name: 'IDX_submission_grades_rubric',
        columnNames: ['rubric_id'],
      }),
    ]);

    await queryRunner.createUniqueConstraint(
      'submission_grades',
      new TableUnique({
        name: 'UQ_submission_grade_attempt',
        columnNames: ['attempt_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'submission_grades',
      new TableForeignKey({
        name: 'FK_submission_grades_rubric',
        columnNames: ['rubric_id'],
        referencedTableName: 'rubrics',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // -----------------------------------------------------------------
    // criterion_grades
    // -----------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'criterion_grades',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'grade_id', type: 'uuid', isNullable: false },
          { name: 'criterion_id', type: 'uuid', isNullable: false },
          { name: 'level_id', type: 'uuid', isNullable: true },
          {
            name: 'points',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          { name: 'comment', type: 'text', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('criterion_grades', [
      new TableIndex({
        name: 'IDX_criterion_grades_grade',
        columnNames: ['grade_id'],
      }),
      new TableIndex({
        name: 'IDX_criterion_grades_criterion',
        columnNames: ['criterion_id'],
      }),
    ]);

    await queryRunner.createUniqueConstraint(
      'criterion_grades',
      new TableUnique({
        name: 'UQ_criterion_grade_per_grade',
        columnNames: ['grade_id', 'criterion_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'criterion_grades',
      new TableForeignKey({
        name: 'FK_criterion_grades_grade',
        columnNames: ['grade_id'],
        referencedTableName: 'submission_grades',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('criterion_grades', true);
    await queryRunner.dropTable('submission_grades', true);
    await queryRunner.dropTable('feedback_templates', true);
    await queryRunner.dropTable('rubric_levels', true);
    await queryRunner.dropTable('rubric_criteria', true);
    await queryRunner.dropTable('rubrics', true);
    await queryRunner.query('DROP TYPE IF EXISTS "submission_grades_status_enum"');
  }
}
