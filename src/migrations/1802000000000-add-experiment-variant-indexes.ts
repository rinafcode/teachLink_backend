import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #1223 — src/ab-testing/entities/experiment-variant.entity.ts declared no
 * indexes. Every real query path against `experiment_variants` loads
 * variants through the `experiment` foreign key (via the `experiment`
 * relation on `IExperimentVariant`, e.g.
 * `experimentRepository.findOne({ relations: [...] })` across the
 * ab-testing services), then filters in-memory for the control variant
 * (`isControl`) or the winning variant (`isWinner`). These two composite
 * indexes match that shape directly. See the `@Index` decorators and their
 * accompanying comment on `IExperimentVariant` for the full rationale,
 * including why this is two composites rather than three separate indexes
 * (a plain `experimentId`-only index would be redundant given either
 * composite already serves that lookup via its leftmost column).
 */
export class AddExperimentVariantIndexes1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_experiment_variants_experiment_isControl" ON "experiment_variants" ("experimentId", "isControl")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_experiment_variants_experiment_isWinner" ON "experiment_variants" ("experimentId", "isWinner")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_experiment_variants_experiment_isWinner"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_experiment_variants_experiment_isControl"',
    );
  }
}
