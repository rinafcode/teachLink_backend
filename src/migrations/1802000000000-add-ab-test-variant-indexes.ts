import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddABTestVariantIndexes1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'ab_test_variants',
      new TableIndex({
        name: 'IDX_ab_test_variants_abTestId_weight',
        columnNames: ['abTestId', 'weight'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('ab_test_variants', 'IDX_ab_test_variants_abTestId_weight');
  }
}
