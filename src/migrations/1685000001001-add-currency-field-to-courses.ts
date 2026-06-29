import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: Add currency field to courses table
 * For supporting multi-currency pricing
 */
export class AddCurrencyFieldToCourses1685000001001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('course');

    if (!table) {
      return;
    }

    // Add currency field
    if (!table.findColumnByName('currency')) {
      await queryRunner.addColumn(
        'course',
        new TableColumn({
          name: 'currency',
          type: 'varchar',
          length: '3',
          default: "'USD'",
          isNullable: true,
        }),
      );
      // Add index
      await queryRunner.createIndex(
        'course',
        new TableIndex({
          columnNames: ['currency'],
          name: 'IDX_course_currency',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('course');

    if (!table) {
      return;
    }

    // Drop index first
    const currencyIndex = table.indices.find((i) => i.name === 'IDX_course_currency');
    if (currencyIndex) {
      await queryRunner.dropIndex('course', currencyIndex);
    }

    // Drop column
    if (table.findColumnByName('currency')) {
      await queryRunner.dropColumn('course', 'currency');
    }
  }
}
