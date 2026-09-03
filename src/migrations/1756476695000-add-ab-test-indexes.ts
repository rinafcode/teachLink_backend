import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAbTestIndexes1756476695000 implements MigrationInterface {
  name = 'AddAbTestIndexes1756476695000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ab_tests_campaignId" ON "ab_tests" ("campaignId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ab_tests_status" ON "ab_tests" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ab_tests_winnerId" ON "ab_tests" ("winnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ab_tests_createdAt" ON "ab_tests" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ab_tests_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ab_tests_winnerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ab_tests_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ab_tests_campaignId"`);
  }
}
