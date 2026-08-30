import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add the supporting indexes used by the email-template lookup and list paths.
 *
 * Common access patterns for this table include:
 * - filtering by template `name`
 * - filtering by `category`
 * - filtering active/inactive templates via `isActive`
 * - ordering recent templates by `createdAt`
 *
 * These indexes align the database schema with the entity metadata and avoid
 * needing to rely on `synchronize` for existing databases.
 */
export class AddEmailTemplateIndexes1805000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_templates_name" ON "email_templates" ("name")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_templates_category" ON "email_templates" ("category")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_templates_is_active" ON "email_templates" ("isActive")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_templates_created_at" ON "email_templates" ("createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_templates_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_templates_is_active"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_templates_category"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_templates_name"');
  }
}
