import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add database indexes to the automation_workflows table.
 *
 * Indexes added:
 *  - IDX_automation_workflows_status           – WHERE status = '...' (active-workflow
 *                                                lookups, activate/deactivate guards)
 *  - IDX_automation_workflows_createdAt        – ORDER BY createdAt DESC (paginated listing)
 *  - IDX_automation_workflows_status_createdAt – composite covering the combined
 *                                                filter-by-status + sort-by-createdAt path
 */
export class AddAutomationWorkflowIndexes1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_automation_workflows_status"
       ON "automation_workflows" ("status")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_automation_workflows_createdAt"
       ON "automation_workflows" ("createdAt")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_automation_workflows_status_createdAt"
       ON "automation_workflows" ("status", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_workflows_status_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_workflows_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_automation_workflows_status"');
  }
}
