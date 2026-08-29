import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddVariantMetricIndexes1689999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndices('variant_metrics', [
      new TableIndex({
        name: 'IDX_variant_metrics_variant_createdAt',
        columnNames: ['variantId', 'createdAt'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('variant_metrics', 'IDX_variant_metrics_variant_createdAt');
  }
}
