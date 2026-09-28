import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutomationActionIndexes1800000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_actions_workflowId" ON "automation_actions" ("workflowId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_actions_type" ON "automation_actions" ("type")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_actions_order" ON "automation_actions" ("order")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_actions_deletedAt" ON "automation_actions" ("deletedAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_actions_workflowId_order" ON "automation_actions" ("workflowId", "order")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_actions_workflowId_type" ON "automation_actions" ("workflowId", "type")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_actions_workflowId_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_actions_workflowId_order"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_actions_deletedAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_actions_order"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_actions_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_actions_workflowId"');
  }
}
