import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../users/entities/user.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { AuthTokensService } from './services/auth-tokens.service';
import { isRS256Configured, loadPEMKey } from './config/jwt-config.factory';
import { InvalidTokenException, ResourceNotFoundException } from '../common/exceptions/app.exceptions';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Default refresh token expiration (7 days)
  private readonly refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly authTokensService: AuthTokensService,
  ) {}

  /**
   * Generates tokens for the user and saves the refresh token hash.
   */
  async login(user: User) {
    const tokens = await this.generateTokens(user);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  /**
   * Refreshes the tokens if the provided refresh token is valid and not blacklisted.
   */
  async refreshTokens(refreshToken: string) {
    let decoded: any;
    try {
      // Verify token signature and expiration
      decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (_e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = decoded.sub;
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Access Denied');
    }

    try {
      const jti = decoded.jti;
      if (!jti) {
        throw new UnauthorizedException('Invalid token format');
      }

      // Check blacklist
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(jti);
      if (isBlacklisted) {
        // Token reuse detected. We should invalidate the current active session.
        this.logger.warn(
          `Revoked refresh token reuse detected for user ${userId}. Revoking current active token.`,
        );
        await this.revokeUserTokens(userId);
        throw new UnauthorizedException('Token has been revoked');
      }

      // Automatically invalidate the old token (rotation)
      const expiresInMs = decoded.exp * 1000 - Date.now();
      if (expiresInMs > 0) {
        await this.tokenBlacklistService.addToBlacklist(jti, expiresInMs);
      }

      // Issue new tokens
      const tokens = await this.generateTokens(user);
      await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
      return tokens;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, accessToken?: string) {
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as any;
        if (decoded?.jti) {
          const remainingMs = decoded.exp * 1000 - Date.now();
          if (remainingMs > 0) {
            await this.tokenBlacklistService.addToBlacklist(decoded.jti, remainingMs);
          }
        }
      } catch {
        // malformed token — still revoke refresh token below
      }
    }
    await this.revokeUserTokens(userId);
  }

  private async revokeUserTokens(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
  }

  // ─── Issue #801 — password reset & email verification ─────────────────
  // These three methods plug the SHA-256-hashed token flow into real routes.
  // All three ultimately delegate to AuthTokensService which owns the hash
  // and the lookups; AuthService just turns user-facing operations into DB
  // updates (e.g. update the password column after a successful reset).

  /**
   * Issues a password-reset token for the user with the given email.
   *
   * The raw token is included in the response ONLY when `EXPOSE_RESET_TOKENS=true`
   * is set explicitly. The default behaviour deliberately omits the raw value so
   * it cannot leak via API logs, browser history, load-test captures, or
   * non-`production` environments (staging, QA, uat, canary) where traffic is
   * often less protected than `production`.
   *
   * Production callers MUST NOT rely on the return value — they must trigger
   * an email worker that delivers the raw token to the user.
   */
  async requestPasswordReset(email: string): Promise<{
    delivered: boolean;
    rawToken?: string;
    expiresAt?: Date;
  }> {
    const user = await this.userRepository.findOne({ where: { email } });
    // Always respond successfully to avoid leaking which emails are registered.
    if (!user) {
      return { delivered: true };
    }
    const { rawToken, expiresAt } = await this.authTokensService.issuePasswordReset(user.id);
    if (process.env.EXPOSE_RESET_TOKENS === 'true') {
      return { delivered: true, rawToken, expiresAt };
    }
    return { delivered: true };
  }

  /**
   * Consumes a raw reset token and writes the new password (bcrypt-hashed).
   * Single-use: {@link AuthTokensService.consumePasswordReset} clears the
   * stored hash atomically with the user lookup.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<User> {
    if (!rawToken || !newPassword) {
      throw new BadRequestException('Token and newPassword are required');
    }
    const user = await this.authTokensService.consumePasswordReset(rawToken);
    if (!user) {
      throw new InvalidTokenException('Password reset token is invalid or has expired');
    }
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    await this.userRepository.update(user.id, { password: hashed });
    // Force refresh-token rotation so a token-stealing scenario can't survive.
    await this.revokeUserTokens(user.id);
    this.logger.log(`Password reset completed for user ${user.id}`);
    return user;
  }

  /**
   * Consumes a raw email-verification token and flips `isEmailVerified`.
   */
  async verifyEmailToken(rawToken: string): Promise<User> {
    if (!rawToken) {
      throw new BadRequestException('Verification token is required');
    }
    const user = await this.authTokensService.consumeEmailVerification(rawToken);
    if (!user) {
      throw new InvalidTokenException('Email verification token is invalid or has expired');
    }
    this.logger.log(`Email verified for user ${user.id}`);
    return user;
  }

  /**
   * Convenience helper exposed for callers that want to issue a verification
   * token directly (e.g. a worker that re-sends the verification email).
   */
  async issueEmailVerificationToken(userId: string): Promise<{
    rawToken: string;
    expiresAt: Date;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }
    return this.authTokensService.issueEmailVerification(user.id);
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.userRepository.update(userId, { refreshToken: hash });
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, jti: accessJti },
        {
          secret: process.env.JWT_SECRET || 'default-jwt-secret',
          expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, jti: refreshJti },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private getPrivateKey(): string | Buffer {
    const key = process.env.JWT_PRIVATE_KEY || '';
    return loadPEMKey(key) || key;
  }
}
