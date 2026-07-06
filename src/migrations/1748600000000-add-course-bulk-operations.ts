import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Adds support for instructor-driven bulk course operations:
 *  - Adds `category` column to `course` for bulk category updates.
 *  - Creates `course_bulk_operations` to record each bulk action with
 *    a per-course snapshot used to power undo.
 */
export class AddCourseBulkOperations1748600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. category column on course
    await queryRunner.query('ALTER TABLE "course" ADD COLUMN IF NOT EXISTS "category" varchar');
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_course_category" ON "course" ("category")',
    );

    // 2. enums for the new table
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "course_bulk_operations_type_enum" AS ENUM (
          'publish', 'unpublish', 'price_update', 'category_update'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "course_bulk_operations_status_enum" AS ENUM (
          'completed', 'partial', 'failed', 'undone'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // 3. course_bulk_operations table
    await queryRunner.createTable(
      new Table({
        name: 'course_bulk_operations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'initiated_by_id', type: 'uuid', isNullable: true },
          { name: 'type', type: 'course_bulk_operations_type_enum', isNullable: false },
          {
            name: 'status',
            type: 'course_bulk_operations_status_enum',
            isNullable: false,
            default: "'completed'",
          },
          { name: 'payload', type: 'jsonb', isNullable: false },
          { name: 'snapshots', type: 'jsonb', isNullable: false, default: "'[]'::jsonb" },
          { name: 'totalCount', type: 'int', isNullable: false, default: 0 },
          { name: 'successCount', type: 'int', isNullable: false, default: 0 },
          { name: 'failureCount', type: 'int', isNullable: false, default: 0 },
          { name: 'undoneAt', type: 'timestamptz', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('course_bulk_operations', [
      new TableIndex({
        name: 'IDX_course_bulk_ops_initiator',
        columnNames: ['initiated_by_id'],
      }),
      new TableIndex({
        name: 'IDX_course_bulk_ops_type',
        columnNames: ['type'],
      }),
    ]);

    await queryRunner.createForeignKey(
      'course_bulk_operations',
      new TableForeignKey({
        name: 'FK_course_bulk_ops_initiator',
        columnNames: ['initiated_by_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('course_bulk_operations', true);
    await queryRunner.query('DROP TYPE IF EXISTS "course_bulk_operations_type_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "course_bulk_operations_status_enum"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_course_category"');
    await queryRunner.query('ALTER TABLE "course" DROP COLUMN IF EXISTS "category"');
  }
}
