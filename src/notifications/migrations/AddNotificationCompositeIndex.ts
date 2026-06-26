import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddNotificationCompositeIndex1700000000000 implements MigrationInterface {
  name = 'AddNotificationCompositeIndex1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_user_type_status_created',
      columnNames: ['userId', 'type', 'status', 'createdAt'],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('notifications', 'IDX_notifications_user_type_status_created');
  }
}