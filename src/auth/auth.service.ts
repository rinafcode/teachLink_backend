import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../users/entities/user.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';

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
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
      }),
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
}
