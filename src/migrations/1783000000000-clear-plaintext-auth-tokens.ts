import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #801 — clears any plaintext `passwordResetToken` /
 * `emailVerificationToken` rows that pre-date the SHA-256 hashing migration.
 *
 * The legacy column values are unrecoverable back to hash form (we never knew
 * the plaintext). Setting them to NULL is the correct action: any pre-existing
 * reset / verification links that the user had in their inbox simply stop
 * working, and the user re-requests a new token — which is now generated and
 * stored correctly via {@link AuthTokensService}.
 *
 * Expiry timestamps are also cleared so the index lookups (used by
 * `consumePasswordReset` / `consumeEmailVerification`) don't return rows
 * with a NULL token but a non-NULL expiry that would confuse downstream logic.
 */
export class ClearPlaintextAuthTokens1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
         SET "passwordResetToken" = NULL,
             "passwordResetExpires" = NULL,
             "emailVerificationToken" = NULL,
             "emailVerificationExpires" = NULL
       WHERE "passwordResetToken" IS NOT NULL
          OR "emailVerificationToken" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // No-op: the cleared plaintext tokens cannot be restored.
  }
}
