import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #832 — Add database indexes on `users.emailVerificationToken` and
 * `users.passwordResetToken`.
 *
 * ## Context
 *
 * The auth-token consumption flows (`AuthTokensService.consumePasswordReset`
 * and `AuthTokensService.consumeEmailVerification`) look up users by these
 * columns:
 *
 * ```ts
 * this.users.findOne({ where: { passwordResetToken: tokenHash } });
 * this.users.findOne({ where: { emailVerificationToken: tokenHash } });
 * ```
 *
 * Neither column had a database index, causing the query planner to perform
 * a **sequential scan (full table scan)** on every token-validation request.
 * This migration adds standard B-tree indexes so lookups execute in O(log n)
 * time via an index scan.
 *
 * ## Design Notes
 *
 * - **B-tree** indexes are the PostgreSQL default and are optimal for equality
 *   lookups (`WHERE col = $1`), which is exactly how these columns are queried.
 * - **Partial indexes** (e.g. `WHERE col IS NOT NULL`) were considered but
 *   rejected: the columns are NULL for the vast majority of rows (only active
 *   token holders have non-NULL values), but TypeORM's auto-generated queries
 *   would not match a partial-index predicate and the query planner might
 *   fall back to a seq scan.
 * - **These columns store SHA-256 hashes** of the raw tokens (see Issue #801
 *   and {@link AuthTokensService.hashToken}). The tokens themselves are
 *   high-entropy 256-bit random secrets that are hashed before storage.
 *   The raw token is delivered to the user once via email and never persisted.
 * - Indexing a hash column is safe because hash collisions on SHA-256 are
 *   negligible; the index does not increase the attack surface.
 *
 * ## Verification
 *
 * After applying the migration, run:
 * ```sql
 * EXPLAIN ANALYZE
 *   SELECT * FROM users
 *    WHERE "emailVerificationToken" = '<some-hash>'
 *      AND "emailVerificationExpires" > NOW();
 * ```
 *
 * Expected output: `Index Scan using ... on users` (not `Seq Scan`).
 */
export class AddAuthTokenIndexes1783000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_users_emailVerificationToken" ON users ("emailVerificationToken")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_passwordResetToken" ON users ("passwordResetToken")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_users_emailVerificationToken"');
    await queryRunner.query('DROP INDEX "IDX_users_passwordResetToken"');
  }
}
