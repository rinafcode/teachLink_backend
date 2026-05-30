import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateMessageTable1630000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'senderId', type: 'uuid', isNullable: false },
          { name: 'recipientId', type: 'uuid', isNullable: false },
          { name: 'content', type: 'text', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'readAt', type: 'timestamptz', isNullable: true },
        ],
      })
    );
    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({ columnNames: ['senderId'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' })
    );
    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({ columnNames: ['recipientId'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('messages');
  }
}
