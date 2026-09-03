import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Issue #1247 — Create the sync table and add database indexes.
 *
 * Uses the TypeORM Table API so `migration:generate --check` sees an exact
 * match between the migration-produced schema and the entity definitions,
 * eliminating schema drift.
 */
export class AddSyncIndexes1806000000000 implements MigrationInterface {
  name = 'AddSyncIndexes1806000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- enum types -------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."sync_operation_enum" AS ENUM ('create', 'update', 'delete');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."sync_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'conflict', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // --- table ------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'sync',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'entity_type',
            type: 'varchar',
            length: '128',
          },
          {
            name: 'entity_id',
            type: 'varchar',
            length: '128',
          },
          {
            name: 'operation',
            type: 'enum',
            enum: ['create', 'update', 'delete'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'in_progress', 'completed', 'conflict', 'failed'],
            default: "'pending'",
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'source_region',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'target_region',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'last_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retry_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'max_retries',
            type: 'int',
            default: 3,
          },
          {
            name: 'last_modified',
            type: 'timestamptz',
          },
          {
            name: 'next_retry_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'rowVersion',
            type: 'int',
            default: 1,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true, // ifNotExists
    );

    // --- indexes ----------------------------------------------------------
    await queryRunner.createIndex(
      'sync',
      new TableIndex({
        name: 'IDX_sync_entity',
        columnNames: ['entity_type', 'entity_id'],
      }),
    );
    await queryRunner.createIndex(
      'sync',
      new TableIndex({
        name: 'IDX_sync_status',
        columnNames: ['status'],
      }),
    );
    await queryRunner.createIndex(
      'sync',
      new TableIndex({
        name: 'IDX_sync_last_modified',
        columnNames: ['last_modified'],
      }),
    );
    await queryRunner.createIndex(
      'sync',
      new TableIndex({
        name: 'IDX_sync_source_region_status',
        columnNames: ['source_region', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'sync',
      new TableIndex({
        name: 'IDX_sync_version',
        columnNames: ['version'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('sync', 'IDX_sync_version');
    await queryRunner.dropIndex('sync', 'IDX_sync_source_region_status');
    await queryRunner.dropIndex('sync', 'IDX_sync_last_modified');
    await queryRunner.dropIndex('sync', 'IDX_sync_status');
    await queryRunner.dropIndex('sync', 'IDX_sync_entity');
    await queryRunner.dropTable('sync');
    await queryRunner.query('DROP TYPE IF EXISTS "public"."sync_status_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "public"."sync_operation_enum"');
  }
}
