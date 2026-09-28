import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddUserConsentIndexes1802000000000 implements MigrationInterface {
  name = 'AddUserConsentIndexes1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_consents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'varchar',
          },
          {
            name: 'consentType',
            type: 'varchar',
          },
          {
            name: 'granted',
            type: 'boolean',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'revokedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX_user_consents_userId',
            columnNames: ['userId'],
          },
          {
            name: 'IDX_user_consents_consentType',
            columnNames: ['consentType'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_consents');
  }
}
