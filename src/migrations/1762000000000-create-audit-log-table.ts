import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuditLogTable1762000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_logs_action_enum" AS ENUM (
          'LOGIN',
          'LOGIN_FAILED',
          'LOGOUT',
          'REGISTER',
          'PASSWORD_RESET_REQUEST',
          'PASSWORD_RESET',
          'PASSWORD_CHANGE',
          'EMAIL_VERIFIED',
          'TOKEN_REFRESH',
          'SESSION_EXPIRED',
          'SESSION_REVOKED',
          'USER_CREATED',
          'USER_UPDATED',
          'USER_DELETED',
          'USER_ROLE_CHANGED',
          'USER_STATUS_CHANGED',
          'DATA_VIEWED',
          'DATA_CREATED',
          'DATA_UPDATED',
          'DATA_DELETED',
          'DATA_EXPORTED',
          'DATA_IMPORTED',
          'FILE_UPLOADED',
          'FILE_DOWNLOADED',
          'FILE_DELETED',
          'FILE_SHARED',
          'API_CALLED',
          'API_RATE_LIMITED',
          'API_ERROR',
          'PERMISSION_DENIED',
          'SUSPICIOUS_ACTIVITY',
          'MFA_ENABLED',
          'MFA_DISABLED',
          'MFA_FAILED',
          'CONFIG_CHANGED',
          'SETTING_UPDATED',
          'BACKUP_CREATED',
          'BACKUP_RESTORED',
          'DATA_RETENTION_APPLIED',
          'AUDIT_LOG_EXPORTED',
          'REPORT_GENERATED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_logs_category_enum" AS ENUM (
          'AUTHENTICATION',
          'AUTHORIZATION',
          'DATA_ACCESS',
          'DATA_MODIFICATION',
          'FILE_OPERATION',
          'SYSTEM',
          'SECURITY',
          'COMPLIANCE'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_logs_severity_enum" AS ENUM (
          'INFO',
          'WARNING',
          'ERROR',
          'CRITICAL'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'version', type: 'int', default: 1 },
          { name: 'user_id', type: 'varchar', isNullable: true },
          { name: 'user_email', type: 'varchar', isNullable: true },
          {
            name: 'action',
            type: 'audit_logs_action_enum',
            isNullable: false,
          },
          {
            name: 'category',
            type: 'audit_logs_category_enum',
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'audit_logs_severity_enum',
            isNullable: false,
            default: `'INFO'`,
          },
          { name: 'entity_type', type: 'varchar', isNullable: true },
          { name: 'entity_id', type: 'varchar', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'old_values', type: 'jsonb', isNullable: true },
          { name: 'new_values', type: 'jsonb', isNullable: true },
          { name: 'ip_address', type: 'varchar', isNullable: true },
          { name: 'user_agent', type: 'varchar', isNullable: true },
          { name: 'session_id', type: 'varchar', isNullable: true },
          { name: 'request_id', type: 'varchar', isNullable: true },
          { name: 'api_endpoint', type: 'varchar', isNullable: true },
          { name: 'http_method', type: 'varchar', isNullable: true },
          { name: 'status_code', type: 'int', isNullable: true },
          { name: 'response_time_ms', type: 'int', isNullable: true },
          { name: 'tenant_id', type: 'varchar', isNullable: true },
          { name: 'timestamp', type: 'timestamptz', default: 'now()' },
          { name: 'retention_until', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('audit_logs', [
      new TableIndex({ name: 'IDX_audit_logs_user_timestamp', columnNames: ['user_id', 'timestamp'] }),
      new TableIndex({ name: 'IDX_audit_logs_action_timestamp', columnNames: ['action', 'timestamp'] }),
      new TableIndex({ name: 'IDX_audit_logs_category_timestamp', columnNames: ['category', 'timestamp'] }),
      new TableIndex({ name: 'IDX_audit_logs_severity_timestamp', columnNames: ['severity', 'timestamp'] }),
      new TableIndex({ name: 'IDX_audit_logs_entity', columnNames: ['entity_type', 'entity_id'] }),
      new TableIndex({ name: 'IDX_audit_logs_ip_address', columnNames: ['ip_address'] }),
      new TableIndex({ name: 'IDX_audit_logs_timestamp', columnNames: ['timestamp'] }),
    ]);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_block_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs are immutable and cannot be modified';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_audit_logs_block_update
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION audit_logs_block_mutation();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_logs_block_update ON audit_logs;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_block_mutation();`);
    await queryRunner.dropTable('audit_logs', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_action_enum"`);
  }
}
