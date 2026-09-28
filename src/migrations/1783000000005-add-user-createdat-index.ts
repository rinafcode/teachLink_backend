import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #<issue-number> — Add database index on `users.createdAt`.
 *
 * ## Context
 *
 * The dashboard user-growth endpoint (`DashboardService.getUserGrowthMetrics`)
 * aggregates signups by month:
 *
 * ```ts
 * this.userRepository.createQueryBuilder('user')
 *   .select(`to_char(date_trunc('month', user.createdAt), 'YYYY-MM')`, 'period')
 *   .addSelect('COUNT(*)', 'newUsers')
 *   .groupBy(`to_char(date_trunc('month', user.createdAt), 'YYYY-MM')`)
 * ```
 *
 * Without an index on `createdAt`, PostgreSQL performs a sequential scan of
 * the entire `users` table for this aggregation.
 *
 * ## Design Notes
 *
 * - **B-tree** index, the PostgreSQL default, is optimal for the range scan
 *   and sort required by `date_trunc(...)` grouped/monthly aggregation.
 * - The `@Index()` decorator added to the `User` entity covers development
 *   environments where `synchronize: true`. This migration covers production
 *   deployments where schema changes are applied via migrations.
 *
 * ## Verification
 *
 * After applying the migration, run:
 * ```sql
 * EXPLAIN ANALYZE
 *   SELECT
 *     to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS period,
 *     COUNT(*) AS newUsers
 *   FROM users
 *   GROUP BY to_char(date_trunc('month', "createdAt"), 'YYYY-MM')
 *   ORDER BY period;
 * ```
 *
 * Expected: `Index Scan` (not `Seq Scan`).
 */
export class AddUserCreatedAtIndex1783000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_users_createdAt" ON users ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_users_createdAt"');
  }
}
