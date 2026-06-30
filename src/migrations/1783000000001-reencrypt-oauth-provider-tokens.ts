import { MigrationInterface, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';

/**
 * Issue #799 — re-encrypts any plaintext `providerAccessToken` /
 * `providerRefreshToken` rows that pre-date the at-rest encryption rollout.
 *
 * Why this is a Node-side migration rather than pure SQL:
 *   The existing values are plaintext application secrets. Re-encrypting them
 *   requires the same `EncryptionService` (AES-256-GCM) that runtime code uses,
 *   which in turn needs `ENCRYPTION_SECRET`. Pure SQL cannot derive a 256-bit
 *   key from a passphrase and (more importantly) should not have access to it.
 *
 * Strategy:
 *   1. Materialise every plaintext OAuth token into JS.
 *   2. Encrypt each value with AES-256-GCM using a random IV per row.
 *   3. Persist the result back as `enc:<JSON>` so {@link SocialAuthService}
 *      recognises and decrypts it on read.
 *   4. Skip values that already carry the `enc:` prefix (idempotency for
 *      re-runs) and skip NULLs.
 *
 * The migration throws if `ENCRYPTION_SECRET` is missing so the deploy
 * pipeline fails LOUD before writing anything.
 *
 * Equivalent code path in the application:
 *   {@link SocialAuthService.encryptToken} (for format reference).
 */
export class ReencryptOAuthProviderTokens1783000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error(
        'ENCRYPTION_SECRET must be set in the migration environment to run Issue #799 re-encryption.',
      );
    }
    const key = crypto.createHash('sha256').update(secret).digest();

    const rows: Array<{
      id: string;
      providerAccessToken: string | null;
      providerRefreshToken: string | null;
    }> = await queryRunner.query(
      `SELECT id,
              "providerAccessToken",
              "providerRefreshToken"
         FROM users
        WHERE ("providerAccessToken" IS NOT NULL AND "providerAccessToken" <> '')
           OR ("providerRefreshToken" IS NOT NULL AND "providerRefreshToken" <> '')`,
    );

    if (rows.length === 0) {
      return;
    }

    for (const row of rows) {
      const encryptedAccess = this.maybeEncrypt(row.providerAccessToken, key);
      const encryptedRefresh = this.maybeEncrypt(row.providerRefreshToken, key);
      await queryRunner.query(
        `UPDATE users
            SET "providerAccessToken" = $1,
                "providerRefreshToken" = $2
          WHERE id = $3`,
        [encryptedAccess, encryptedRefresh, row.id],
      );
    }
  }

  public async down(): Promise<void> {
    // No-op: AES-GCM ciphertext cannot be reversed without the key, and the
    // migration is not the place to log or stash the raw values.
  }

  private maybeEncrypt(stored: string | null, key: Buffer): string | null {
    if (!stored) return null;
    if (stored.startsWith('enc:')) {
      // Already encrypted — leave as-is so re-runs are idempotent.
      return stored;
    }
    return 'enc:' + JSON.stringify(this.aesGcmEncrypt(stored, key));
  }

  private aesGcmEncrypt(plaintext: string, key: Buffer): {
    iv: string;
    content: string;
    tag: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex'),
      tag: tag.toString('hex'),
    };
  }
}
