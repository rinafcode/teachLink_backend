import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Adds database indexes to the `email_templates` table.
 *
 * These cover the common lookups/sorts on the entity:
 *  - `name` is used for filtering/searching by template name.
 *  - `createdAt` is used for ordering/pagination (e.g. most recent templates).
 *
 * The `key` column is intentionally NOT indexed here because it is declared
 * `UNIQUE`, which already creates a unique index. The primary key `id` is also
 * already covered by its own index, so no redundant indexes are introduced.
 */
export class AddEmailTemplateIndexes1788076191928 implements MigrationInterface {
  name = 'AddEmailTemplateIndexes1788076191928';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'email_templates',
      new TableIndex({
        name: 'IDX_email_templates_name',
        columnNames: ['name'],
      }),
    );

    await queryRunner.createIndex(
      'email_templates',
      new TableIndex({
        name: 'IDX_email_templates_created_at',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('email_templates', 'IDX_email_templates_created_at');
    await queryRunner.dropIndex('email_templates', 'IDX_email_templates_name');
  }
}
