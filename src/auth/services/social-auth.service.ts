import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  EncryptionService,
  IEncryptedPayload,
} from '../../security/encryption/encryption.service';

export interface SocialProfile {
  provider: string;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  accessToken?: string;
  refreshToken?: string;
}

/** Opaque prefix that marks a stored value as an AES-GCM JSON payload. */
const ENCRYPTED_PREFIX = 'enc:';

/**
 * Issue #799 — OAuth provider tokens were previously stored as plaintext on the
 * `providerAccessToken` / `providerRefreshToken` User columns. A DB breach
 * exposed every user's Google / GitHub credentials immediately.
 *
 * This service now encrypts both fields with {@link EncryptionService}
 * (AES-256-GCM) before persistence and exposes symmetric
 * `getDecryptedAccessToken` / `getDecryptedRefreshToken` /
 * `getDecryptedProviderTokens` helpers for callers that need the plaintext
 * value at runtime (e.g. a refresh-token rotation job).
 *
 * Encrypted payloads are serialised as `<prefix><base64-ish JSON>` so a
 * downstream consumer can distinguish "encrypted" from "legacy plaintext"
 * during the migration window.
 */
@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async findOrCreateFromProvider(profile: SocialProfile): Promise<User> {
    const existing = await this.users.findOne({
      where: { provider: profile.provider, providerId: profile.providerId },
    });
    if (existing) return existing;

    if (profile.email) {
      const byEmail = await this.users.findOne({ where: { email: profile.email } });
      if (byEmail) {
        if (byEmail.provider && byEmail.provider !== profile.provider) {
          throw new ConflictException(
            `Email already registered with ${byEmail.provider}. Please sign in with that provider.`,
          );
        }
        byEmail.provider = profile.provider;
        byEmail.providerId = profile.providerId;
        byEmail.providerAccessToken = this.encryptToken(profile.accessToken);
        byEmail.providerRefreshToken = this.encryptToken(profile.refreshToken);
        if (profile.picture && !byEmail.profilePicture) {
          byEmail.profilePicture = profile.picture;
        }
        return this.users.save(byEmail);
      }
    }

    // Derive a username-like base from the email local part for fallback names.
    const emailLocalPart = profile.email ? profile.email.split('@')[0] : profile.providerId;

    const firstName = profile.firstName?.trim() || emailLocalPart;
    const lastName = profile.lastName?.trim() || '';

    const user = this.users.create({
      email: profile.email,
      firstName,
      lastName,
      profilePicture: profile.picture,
      provider: profile.provider,
      providerId: profile.providerId,
      providerAccessToken: this.encryptToken(profile.accessToken),
      providerRefreshToken: this.encryptToken(profile.refreshToken),
      isEmailVerified: true,
    });
    return this.users.save(user);
  }

  async linkProvider(userId: string, profile: SocialProfile): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    user.provider = profile.provider;
    user.providerId = profile.providerId;
    user.providerAccessToken = this.encryptToken(profile.accessToken);
    user.providerRefreshToken = this.encryptToken(profile.refreshToken);
    return this.users.save(user);
  }

  async unlinkProvider(userId: string): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    user.provider = null;
    user.providerId = null;
    user.providerAccessToken = null;
    user.providerRefreshToken = null;
    return this.users.save(user);
  }

  /**
   * Returns the plaintext OAuth access token for `userId`, or `null` if none is
   * stored. Decrypts transparently; throws on encrypted-but-malformed input so
   * a corrupt DB row is surfaced loudly rather than silently misleading callers.
   */
  async getDecryptedAccessToken(userId: string): Promise<string | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    return this.decryptStoredToken(user?.providerAccessToken);
  }

  /**
   * Returns the plaintext OAuth refresh token for `userId`, or `null` if none
   * is stored. See {@link SocialAuthService.getDecryptedAccessToken}.
   */
  async getDecryptedRefreshToken(userId: string): Promise<string | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    return this.decryptStoredToken(user?.providerRefreshToken);
  }

  /**
   * Reads the User row once and decrypts BOTH provider tokens in a single
   * round-trip. Prefer this over calling the individual helpers if you need
   * both tokens — it avoids a duplicate DB query.
   */
  async getDecryptedProviderTokens(
    userId: string,
  ): Promise<{ access: string | null; refresh: string | null }> {
    const user = await this.users.findOne({ where: { id: userId } });
    return {
      access: this.decryptStoredToken(user?.providerAccessToken),
      refresh: this.decryptStoredToken(user?.providerRefreshToken),
    };
  }

  /**
   * Encrypts an OAuth token; returns `null` for missing input so the DB column
   * can carry the same shape regardless of whether the provider issued a token.
   * JSON serialisation is used (instead of `iv.content.tag`) so the format is
   * robust against any future hex encoding change.
   */
  private encryptToken(rawToken: string | undefined): string | null {
    if (!rawToken) return null;
    const payload = this.encryptionService.encrypt(rawToken);
    return ENCRYPTED_PREFIX + JSON.stringify(payload);
  }

  /**
   * Reverse of {@link SocialAuthService.encryptToken}. Returns `null` for
   * missing input. Treats legacy plaintext values (no prefix) as `null` — they
   * are unusable and reading them would just leak the (already compromised)
   * plaintext to the caller. Throws if the value looks encrypted but
   * decryption fails so operator is alerted to corruption.
   */
  private decryptStoredToken(stored: string | null | undefined): string | null {
    if (!stored) return null;
    if (!stored.startsWith(ENCRYPTED_PREFIX)) {
      this.logger.warn(
        'Legacy plaintext OAuth token encountered on a User row. Treating as unusable; please run the encryption migration.',
      );
      return null;
    }
    let payload: IEncryptedPayload;
    try {
      payload = JSON.parse(stored.slice(ENCRYPTED_PREFIX.length));
    } catch {
      throw new Error('Malformed encrypted OAuth token payload');
    }
    if (
      !payload ||
      typeof payload.iv !== 'string' ||
      typeof payload.content !== 'string' ||
      typeof payload.tag !== 'string'
    ) {
      throw new Error('Malformed encrypted OAuth token payload');
    }
    return this.encryptionService.decrypt(payload);
  }
}
