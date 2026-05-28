import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSchemaVersionAndChangeTables1680000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'schema_version',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'schemaName', type: 'varchar', length: 255, isNullable: false },
          { name: 'definition', type: 'jsonb', isNullable: false },
          { name: 'checksum', type: 'varchar', length: 64, isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'NOW()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'schema_change',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'schemaName', type: 'varchar', length: 255, isNullable: false },
          { name: 'fromVersion', type: 'varchar', length: 50, isNullable: false },
          { name: 'toVersion', type: 'varchar', length: 50, isNullable: false },
          { name: 'changeType', type: 'enum', enum: ['ADD_COLUMN','DROP_COLUMN','MODIFY_COLUMN','ADD_INDEX','DROP_INDEX','ADD_TABLE','DROP_TABLE','ADD_RELATION','DROP_RELATION'] },
          { name: 'fieldPath', type: 'varchar', length: 255, isNullable: false },
          { name: 'previousValue', type: 'jsonb', isNullable: true },
          { name: 'newValue', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'NOW()' },
          { name: 'schemaVersionId', type: 'uuid', isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'schema_change',
      new TableForeignKey({
        columnNames: ['schemaVersionId'],
        referencedTableName: 'schema_version',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('schema_change');
    await queryRunner.dropTable('schema_version');
  }
}
