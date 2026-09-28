import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddExperimentMetricIndexes1801000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndices('experiment_metrics', [
      new TableIndex({
        name: 'IDX_experiment_metrics_experiment_id',
        columnNames: ['experimentId'],
      }),
      new TableIndex({
        name: 'IDX_experiment_metrics_type',
        columnNames: ['type'],
      }),
      new TableIndex({
        name: 'IDX_experiment_metrics_created_at',
        columnNames: ['createdAt'],
      }),
      new TableIndex({
        name: 'IDX_experiment_metrics_experiment_is_primary',
        columnNames: ['experimentId', 'isPrimary'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'experiment_metrics',
      'IDX_experiment_metrics_experiment_is_primary',
    );
    await queryRunner.dropIndex('experiment_metrics', 'IDX_experiment_metrics_created_at');
    await queryRunner.dropIndex('experiment_metrics', 'IDX_experiment_metrics_type');
    await queryRunner.dropIndex('experiment_metrics', 'IDX_experiment_metrics_experiment_id');
  }
}
