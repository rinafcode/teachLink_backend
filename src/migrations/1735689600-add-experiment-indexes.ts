import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperimentIndexes1735689600 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX "IDX_experiments_status" ON "experiments" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_experiments_type" ON "experiments" ("type")');
    await queryRunner.query(
      'CREATE INDEX "IDX_experiments_start_date" ON "experiments" ("startDate")',
    );
    await queryRunner.query('CREATE INDEX "IDX_experiments_end_date" ON "experiments" ("endDate")');
    await queryRunner.query(
      'CREATE INDEX "IDX_experiments_created_at" ON "experiments" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_experiments_updated_at" ON "experiments" ("updatedAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_experiments_status"');
    await queryRunner.query('DROP INDEX "IDX_experiments_type"');
    await queryRunner.query('DROP INDEX "IDX_experiments_start_date"');
    await queryRunner.query('DROP INDEX "IDX_experiments_end_date");
    await queryRunner.query('DROP INDEX "IDX_experiments_created_at"');
    await queryRunner.query('DROP INDEX "IDX_experiments_updated_at"');
  }
}
