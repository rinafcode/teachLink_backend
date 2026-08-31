import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserConsentIndexes1802000000000 implements MigrationInterface {
  name = 'AddUserConsentIndexes1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX "IDX_user_consents_userId" ON "user_consents" ("userId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_consents_consentType" ON "user_consents" ("consentType")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_user_consents_consentType"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_user_consents_userId"',
    );
  }
}
