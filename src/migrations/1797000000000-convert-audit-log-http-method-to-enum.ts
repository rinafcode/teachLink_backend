import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convert `audit_logs.http_method` from varchar to a PostgreSQL enum,
 * aligning the database schema with the AuditLog entity which declares
 * `type: 'enum', enum: HttpMethod`.
 *
 * See issue #1203.
 */
export class ConvertAuditLogHttpMethodToEnum1797000000000 implements MigrationInterface {
  name = 'ConvertAuditLogHttpMethodToEnum1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the enum type (idempotent).
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_logs_http_method_enum" AS ENUM (
          'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // 2. Cast the existing varchar column to the new enum type.
    //    Any existing values that don't match a valid enum member will cause
    //    the migration to fail, which is the desired safety check.
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "http_method"
        TYPE "audit_logs_http_method_enum"
        USING "http_method"::"audit_logs_http_method_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the column back to varchar.
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ALTER COLUMN "http_method"
        TYPE "character varying"
        USING "http_method"::"text"
    `);

    await queryRunner.query('DROP TYPE IF EXISTS "audit_logs_http_method_enum"');
  }
}
