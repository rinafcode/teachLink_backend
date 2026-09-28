import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { User, UserStatus } from '../users/entities/user.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { SecurityEventLogger, SecurityEventType } from '../security/audit/security-event-logger';
import { loadPEMKey } from './config/jwt-config.factory';

@Injectable()
export class AuthService {
  // Default refresh token expiration (7 days)
  private readonly refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly securityEventLogger: SecurityEventLogger,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Centralized security invariant asserting user account state prior to issuing tokens.
   * Prevents inactive, suspended, pending, or banned users from obtaining access or refresh tokens.
   */
  public assertUserMayAuthenticate(user: User, action = 'auth', ip?: string): void {
    if (!user || user.status !== UserStatus.ACTIVE) {
      if (user) {
        this.securityEventLogger.emit({
          eventType: SecurityEventType.ACCOUNT_LOCKED,
          userId: user.id,
          ip,
          severity: 'high',
          details: {
            reason: 'inactive_user_auth_attempt',
            action,
            status: user.status,
          },
        });
      }
      throw new UnauthorizedException('User is not active');
    }
  }

  /**
   * Generates tokens for the user and saves the refresh token hash.
   */
  async login(user: User, ip?: string) {
    this.assertUserMayAuthenticate(user, 'login', ip);

    const tokens = await this.generateTokens(user);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  emitAuthFailure(details: Record<string, unknown>, userId?: string | null, ip?: string | null) {
    this.securityEventLogger.emit({
      eventType: SecurityEventType.AUTH_FAILURE,
      userId,
      ip,
      severity: 'medium',
      details,
    });
  }

  /**
   * Refreshes the tokens if the provided refresh token is valid and not blacklisted.
   */
  async refreshTokens(refreshToken: string, ip?: string) {
    let decoded: any;
    try {
      // Verify token signature and expiration
      decoded = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (_e) {
      this.securityEventLogger.emit({
        eventType: SecurityEventType.AUTH_FAILURE,
        ip,
        severity: 'medium',
        details: {
          reason: 'invalid_or_expired_refresh_token',
          action: 'refreshTokens',
        },
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = decoded.sub;
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user || !user.refreshToken) {
      this.securityEventLogger.emit({
        eventType: SecurityEventType.AUTH_FAILURE,
        userId,
        ip,
        severity: 'medium',
        details: {
          reason: !user ? 'user_not_found' : 'missing_refresh_token',
          action: 'refreshTokens',
        },
      });
      throw new UnauthorizedException('Access Denied');
    }

    this.assertUserMayAuthenticate(user, 'refreshTokens', ip);

    const refreshTokenMatches = timingSafeEqual(
      Buffer.from(this.hashRefreshToken(refreshToken)),
      Buffer.from(user.refreshToken),
    );

    if (!refreshTokenMatches) {
      this.securityEventLogger.emit({
        eventType: SecurityEventType.AUTH_FAILURE,
        userId,
        ip,
        severity: 'high',
        details: {
          reason: 'refresh_token_hash_mismatch',
          action: 'refreshTokens',
        },
      });
      throw new UnauthorizedException('Access Denied');
    }

    try {
      const jti = decoded.jti;
      if (!jti) {
        this.securityEventLogger.emit({
          eventType: SecurityEventType.AUTH_FAILURE,
          userId,
          ip,
          severity: 'medium',
          details: {
            reason: 'missing_refresh_token_jti',
            action: 'refreshTokens',
          },
        });
        throw new UnauthorizedException('Invalid token format');
      }

      // Check blacklist
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(jti);
      if (isBlacklisted) {
        // Token reuse detected. We should invalidate the current active session.
        this.securityEventLogger.emit({
          eventType: SecurityEventType.TOKEN_REUSE,
          userId,
          ip,
          severity: 'critical',
          details: {
            reason: 'blacklisted_refresh_token_reused',
            action: 'refreshTokens',
            jti,
          },
        });
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

  private hashRefreshToken(token: string): string {
    const secret =
      process.env.HMAC_SECRET || process.env.JWT_REFRESH_SECRET || 'default-hmac-secret';
    return createHmac('sha256', secret).update(token).digest('hex');
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const hash = this.hashRefreshToken(refreshToken);
    await this.userRepository.update(userId, { refreshToken: hash });
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

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
