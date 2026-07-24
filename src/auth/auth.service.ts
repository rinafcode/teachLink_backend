import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';
import {
  SecurityEventLogger,
  SecurityEventType,
} from '../security/audit/security-event-logger';

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
  ) {}

  /**
   * Generates tokens for the user and saves the refresh token hash.
   */
  async login(user: User) {
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
        secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
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
    const user = await this.userRepository.findOneBy({ id: userId });

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

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
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

  async logout(userId: string) {
    await this.revokeUserTokens(userId);
  }

  private async revokeUserTokens(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.userRepository.update(userId, { refreshToken: hash });
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const refreshJti = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'default-jwt-secret',
        expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
      }),
      this.jwtService.signAsync(
        { ...payload, jti: refreshJti },
        {
          secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
          expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
