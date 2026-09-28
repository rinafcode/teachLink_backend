import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #850 — Clear legacy bcrypt-hashed refresh tokens.
 *
 * ## Context
 *
 * Refresh tokens were previously stored as bcrypt hashes (identifiable by the
 * `$2b$` prefix). As part of the migration to HMAC-SHA-256 for refresh token
 * storage, all existing bcrypt hashes must be cleared because they cannot be
 * converted to the new hashing scheme (bcrypt is one-way).
 *
 * Setting `refreshToken` to NULL forces affected users to re-login on their
 * next API call. During re-login, a new refresh token is issued and stored
 * using HMAC-SHA-256.
 *
 * ## Irreversibility
 *
 * This migration is **not reversible**. Bcrypt hashes cannot be converted back
 * to plaintext or re-hashed with HMAC-SHA-256. The `down()` method is a no-op.
 *
 * ## Timestamp note (issue #1196)
 *
 * Originally shared the timestamp `1783000000003` with
 * `add-course-full-text-search`, making the relative order of the two
 * migrations dependent on file-load order. Renumbered to `1783000000006` (the
 * next free slot after `1783000000005-add-user-createdat-index`) so this
 * data-updating migration deterministically runs after the DDL migrations in
 * the `1783000000xxx` block rather than racing one of them.
 */
export class ClearLegacyBcryptRefreshTokens1783000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
         SET "refreshToken" = NULL
       WHERE "refreshToken" LIKE '$2b$%'
    `);
  }

  public async down(): Promise<void> {
    // Cannot reverse this migration - bcrypt hashes cannot be recovered from HMAC-SHA-256 hashes.
    // Affected users will need to re-login to obtain new refresh tokens.
  }
}
