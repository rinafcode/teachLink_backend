import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { SessionService } from '../session/session.service';
import { TransactionService } from '../common/database/transaction.service';
import { UserRole } from '../users/entities/user.entity';
import {
  ensureValidCredentials,
  ensureUserIsActive,
  ensureValidUserToken,
} from '../common/utils/user.utils';
import { NotificationsService } from '../notifications/notifications.service';

interface JwtTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
}

interface RegisterResponse {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
  message: string;
}

interface LoginResponse {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
}

interface TokenUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly transactionService: TransactionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    return await this.transactionService.runInTransaction(async (_manager) => {
      // Create user
      const user = await this.usersService.create(registerDto);

      // Generate email verification token
      const verificationToken = this.generateRandomToken();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.usersService.updateEmailVerificationToken(
        user.id,
        verificationToken,
        verificationExpires,
      );

      // Send verification email
      await this.notificationsService.sendVerificationEmail(user.email, verificationToken);

      const sessionId = await this.sessionService.createSession(user.id, { type: 'auth-register' });
      const { accessToken, refreshToken } = await this.generateTokens(user, sessionId);

      // Save refresh token
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken,
        refreshToken,
        message: 'Registration successful. Please check your email to verify your account.',
      };
    });
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    // Find user
    const userOrNull = await this.usersService.findByEmail(loginDto.email);
    const user = ensureValidCredentials(userOrNull);

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    ensureUserIsActive(user);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const sessionId = await this.sessionService.createSession(user.id, { type: 'auth-login' });
    const { accessToken, refreshToken } = await this.generateTokens(user, sessionId);

    // Save refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key',
      });
      return this.sessionService.withLock(`refresh:${payload.sub}`, async () => {
        // Find user
        const user = await this.usersService.findOne(payload.sub);
        if (!user || !user.refreshToken) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        // Verify stored refresh token
        const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
        if (!isRefreshTokenValid) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        let sessionId = payload.sid as string | undefined;
        if (sessionId) {
          const session = await this.sessionService.getSession(sessionId);
          if (!session) {
            sessionId = await this.sessionService.createSession(user.id, { type: 'auth-refresh' });
          } else {
            await this.sessionService.touchSession(sessionId, {
              lastRefreshAt: Date.now(),
            });
          }
        } else {
          sessionId = await this.sessionService.createSession(user.id, { type: 'auth-refresh' });
        }

        // Generate new tokens
        const tokens = await this.generateTokens(user, sessionId);

        // Update refresh token
        const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

        return tokens;
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, sessionId?: string): Promise<{ message: string }> {
    await this.sessionService.withLock(`logout:${userId}`, async () => {
      if (sessionId) {
        await this.sessionService.removeSession(sessionId);
      }
      await this.usersService.updateRefreshToken(userId, null);
    });

    return { message: 'Logout successful' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    // Generate reset token
    const resetToken = this.generateRandomToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.usersService.updatePasswordResetToken(user.id, resetToken, resetExpires);

    // Send password reset email
    await this.notificationsService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a password reset link has been sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    // Find user by reset token
    const userOrNull = await this.usersService.findByPasswordResetToken(resetPasswordDto.token);
    const user = ensureValidUserToken(
      userOrNull,
      'passwordResetToken',
      'passwordResetExpires',
      'Invalid or expired reset token',
    );

    // Update password
    await this.usersService.update(user.id, { password: resetPasswordDto.newPassword });

    // Clear reset token
    await this.usersService.updatePasswordResetToken(user.id, null, null);

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOne(userId);

    // Verify current password
    const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Update password
    await this.usersService.update(userId, { password: changePasswordDto.newPassword });

    return { message: 'Password changed successfully' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    // Find user by verification token
    const userOrNull = await this.usersService.findByEmailVerificationToken(token);
    const user = ensureValidUserToken(
      userOrNull,
      'emailVerificationToken',
      'emailVerificationExpires',
      'Invalid or expired verification token',
    );

    // Update user as verified
    await this.usersService.update(user.id, { isEmailVerified: true });

    // Clear verification token
    await this.usersService.updateEmailVerificationToken(user.id, null, null);

    return { message: 'Email verified successfully' };
  }

  private async generateTokens(user: TokenUser, sessionId: string): Promise<AuthTokens> {
    const payload: JwtTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        expiresIn: parseInt(this.configService.get<string>('JWT_EXPIRES_IN') || '900', 10), // 900s = 15m
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key',
        expiresIn: parseInt(
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '604800',
          10,
        ), // 604800s = 7d
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateRandomToken(): string {
    return randomBytes(32).toString('hex');
  }
}
