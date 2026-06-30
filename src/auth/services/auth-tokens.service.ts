import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Issue #801 — Plaintext password-reset and email-verification tokens are
 * equivalent to a database-stored credential. We persist only the SHA-256
 * hash of the raw token; the raw token is delivered once to the user (via
 * email) and never written to disk.
 *
 * Why SHA-256, not bcrypt:
 *  - These tokens are short-lived (~24 h) and high-entropy (32 bytes of
 *    cryptographic randomness).
 *  - bcrypt's intentional CPU cost is calibrated against *low-entropy* inputs
 *    (human-chosen passwords); it provides no marginal benefit when the input
 *    is a 256-bit random secret and only adds latency to every lookup.
 *  - SHA-256 lets us look tokens up deterministically (WHERE hash = $1),
 *    avoiding the iterative-compare pattern bcrypt forces.
 */

const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns the SHA-256 (hex) hash of the supplied raw token. Used both as
 * the persistence format (column value) and as the comparison key for
 * validation.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

@Injectable()
export class AuthTokensService {
  private readonly logger = new Logger(AuthTokensService.name);
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.ttlMs = DEFAULT_TOKEN_TTL_MS;
  }

  /**
   * Generates a cryptographically-random 32-byte token and returns both the
   * raw value (give this to the user via email) and the SHA-256 hash (the
   * value to write to the database).
   */
  generateTokenPair(): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.ttlMs);
    return { rawToken, tokenHash, expiresAt };
  }

  /**
   * Issues a password-reset token for the given user.
   *
   * Returns the *raw* token so the caller can deliver it to the user via
   * email. The hashed version is written to the User row; the raw token is
   * never persisted.
   */
  async issuePasswordReset(userId: string): Promise<{
    rawToken: string;
    expiresAt: Date;
  }> {
    const { rawToken, tokenHash, expiresAt } = this.generateTokenPair();
    await this.users.update(
      { id: userId },
      {
        passwordResetToken: tokenHash,
        passwordResetExpires: expiresAt,
      },
    );
    return { rawToken, expiresAt };
  }

  /**
   * Issues an email-verification token for the given user.
   */
  async issueEmailVerification(userId: string): Promise<{
    rawToken: string;
    expiresAt: Date;
  }> {
    const { rawToken, tokenHash, expiresAt } = this.generateTokenPair();
    await this.users.update(
      { id: userId },
      {
        emailVerificationToken: tokenHash,
        emailVerificationExpires: expiresAt,
      },
    );
    return { rawToken, expiresAt };
  }

  /**
   * Validates a raw password-reset token submitted by the user. On match the
   * stored token is cleared (single-use semantics) and the user is returned.
   * Returns null when the token does not match any active row OR has expired.
   */
  async consumePasswordReset(rawToken: string): Promise<User | null> {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);
    const user = await this.users.findOne({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: MoreThan(new Date()),
      },
    });
    if (!user) return null;
    await this.users.update(
      { id: user.id },
      {
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    );
    return user;
  }

  /**
   * Validates a raw email-verification token submitted by the user. Sets
   * `isEmailVerified=true` on match and clears the stored token.
   */
  async consumeEmailVerification(rawToken: string): Promise<User | null> {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);
    const user = await this.users.findOne({
      where: {
        emailVerificationToken: tokenHash,
        emailVerificationExpires: MoreThan(new Date()),
      },
    });
    if (!user) return null;
    await this.users.update(
      { id: user.id },
      {
        emailVerificationToken: null,
        emailVerificationExpires: null,
        isEmailVerified: true,
      },
    );
    return user;
  }

  /**
   * Verifies a raw token against a stored hash. Exposed for callers that
   * already have the stored hash (e.g. when an alternative storage scheme
   * is used in the future).
   */
  verifyTokenHash(rawToken: string, storedHash: string | null | undefined): boolean {
    if (!rawToken || !storedHash) return false;
    const candidate = hashToken(rawToken);
    // Constant-time comparison guards against timing side-channels. SHA-256
    // strings are always 64 hex chars, so the lengths match by construction.
    return crypto.timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  }
}
