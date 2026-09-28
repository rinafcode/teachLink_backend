import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddNotificationPreferencesIndexes1800000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.getTable('notification_preferences'))!;
    await queryRunner.createIndices(table, [
      new TableIndex({
        name: 'IDX_notification_preferences_user_id',
        columnNames: ['userId'],
      }),
      new TableIndex({
        name: 'IDX_notification_preferences_global_unsub',
        columnNames: ['globalUnsubscribe'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'notification_preferences',
      'IDX_notification_preferences_global_unsub',
    );
    await queryRunner.dropIndex('notification_preferences', 'IDX_notification_preferences_user_id');
  }
}
