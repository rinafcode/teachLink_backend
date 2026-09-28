import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #XXXX — Add database indexes to the automation-trigger entity.
 *
 * Query patterns observed in the automation workflow service:
 *  - `find({ where: { type: triggerType }})` for active trigger matching
 *  - `softDelete({ workflowId: id })` and joins against workflow rows
 *
 * Indexes added:
 *  - IDX_automation_triggers_workflowId — foreign-key lookup for workflow joins
 *  - IDX_automation_triggers_type       — trigger-type filters during execution
 */
export class AddAutomationTriggerIndexes1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_triggers_workflowId" ON "automation_triggers" ("workflowId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_automation_triggers_type" ON "automation_triggers" ("type")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_triggers_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_triggers_workflowId"');
  }
}
