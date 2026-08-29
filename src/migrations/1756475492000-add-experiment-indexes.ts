import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Adds indexes covering the common lookup / filter / sort / foreign-key
 * columns on the `experiment` entity.
 *
 * Indexes created:
 *  - IDX_experiment_status         : filtering by status (WHERE status = ...)
 *  - IDX_experiment_projectId      : foreign-key lookups / filtering by project
 *  - IDX_experiment_createdById    : foreign-key lookups by owner/creator
 *  - IDX_experiment_createdAt      : sorting (ORDER BY createdAt)
 *  - IDX_experiment_project_status : composite for the common
 *                                   "experiments for a project by status" path
 */
export class AddExperimentIndexes1756475492000 implements MigrationInterface {
  name = 'AddExperimentIndexes1756475492000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'experiment',
      new TableIndex({
        name: 'IDX_experiment_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'experiment',
      new TableIndex({
        name: 'IDX_experiment_projectId',
        columnNames: ['projectId'],
      }),
    );

    await queryRunner.createIndex(
      'experiment',
      new TableIndex({
        name: 'IDX_experiment_createdById',
        columnNames: ['createdById'],
      }),
    );

    await queryRunner.createIndex(
      'experiment',
      new TableIndex({
        name: 'IDX_experiment_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    // Composite index for the frequent "list a project's experiments
    // filtered by status" query path.
    await queryRunner.createIndex(
      'experiment',
      new TableIndex({
        name: 'IDX_experiment_project_status',
        columnNames: ['projectId', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('experiment', 'IDX_experiment_project_status');
    await queryRunner.dropIndex('experiment', 'IDX_experiment_createdAt');
    await queryRunner.dropIndex('experiment', 'IDX_experiment_createdById');
    await queryRunner.dropIndex('experiment', 'IDX_experiment_projectId');
    await queryRunner.dropIndex('experiment', 'IDX_experiment_status');
  }
}
