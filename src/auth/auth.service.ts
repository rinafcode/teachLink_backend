import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { SessionService } from '../session/session.service';
import { TransactionService } from '../common/database/transaction.service';
import { UserRole } from '../users/entities/user.entity';
import { ensureValidCredentials, ensureUserIsActive, ensureValidUserToken, } from '../common/utils/user.utils';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditSeverity } from '../audit-log/enums/audit-action.enum';
import { PasswordPolicyService } from './services/password-policy.service';

interface IJwtTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
}

interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface IAuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
}

interface IRegisterResponse {
  user: IAuthUserResponse;
  accessToken: string;
  refreshToken: string;
  message: string;
}

interface ILoginResponse {
  user: IAuthUserResponse;
  accessToken: string;
  refreshToken: string;
}

interface ITokenUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Provides auth operations.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly transactionService: TransactionService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  /**
   * Registers register.
   * @param registerDto The request payload.
   * @param ipAddress The ip address.
   * @param userAgent The user agent.
   * @returns The resulting register response.
   */
  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IRegisterResponse> {
    await this.passwordPolicyService.enforce(registerDto.password);

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

      // Log registration
      await this.auditLogService.logAuth(
        AuditAction.REGISTER,
        user.id,
        user.email,
        ipAddress || 'unknown',
        userAgent || 'unknown',
        { sessionId },
      );

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

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string): Promise<ILoginResponse> {
    // Find user
    const userOrNull = await this.usersService.findByEmail(loginDto.email);

    // Log failed login attempt if user not found
    if (!userOrNull) {
      await this.auditLogService.logAuth(
        AuditAction.LOGIN_FAILED,
        null,
        loginDto.email,
        ipAddress || 'unknown',
        userAgent || 'unknown',
        { reason: 'User not found' },
        AuditSeverity.WARNING,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = ensureValidCredentials(userOrNull);

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      await this.auditLogService.logAuth(
        AuditAction.LOGIN_FAILED,
        user.id,
        user.email,
        ipAddress || 'unknown',
        userAgent || 'unknown',
        { reason: 'Invalid password' },
        AuditSeverity.WARNING,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    try {
      ensureUserIsActive(user);
    } catch (error) {
      await this.auditLogService.logAuth(
        AuditAction.LOGIN_FAILED,
        user.id,
        user.email,
        ipAddress || 'unknown',
        userAgent || 'unknown',
        { reason: 'User account inactive' },
        AuditSeverity.WARNING,
      );
      throw error;
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const sessionId = await this.sessionService.createSession(user.id, { type: 'auth-login' });
    const { accessToken, refreshToken } = await this.generateTokens(user, sessionId);

    // Save refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    // Log successful login
    await this.auditLogService.logAuth(
      AuditAction.LOGIN,
      user.id,
      user.email,
      ipAddress || 'unknown',
      userAgent || 'unknown',
      { sessionId },
    );

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

  async refreshToken(refreshToken: string): Promise<IAuthTokens> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key',
      });
      return this.sessionService.withLock(`refresh:${payload.sub}`, async () => {
        // Find user
        const userOrNull = await this.usersService.findByEmail(loginDto.email);
        // Log failed login attempt if user not found
        if (!userOrNull) {
            await this.auditLogService.logAuth(AuditAction.LOGIN_FAILED, null, loginDto.email, ipAddress || 'unknown', userAgent || 'unknown', { reason: 'User not found' }, AuditSeverity.WARNING);
            throw new UnauthorizedException('Invalid credentials');
        }
        const user = ensureValidCredentials(userOrNull);
        // Verify password
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            await this.auditLogService.logAuth(AuditAction.LOGIN_FAILED, user.id, user.email, ipAddress || 'unknown', userAgent || 'unknown', { reason: 'Invalid password' }, AuditSeverity.WARNING);
            throw new UnauthorizedException('Invalid credentials');
        }
        // Check if user is active
        try {
            ensureUserIsActive(user);
        }
        catch (error) {
            await this.auditLogService.logAuth(AuditAction.LOGIN_FAILED, user.id, user.email, ipAddress || 'unknown', userAgent || 'unknown', { reason: 'User account inactive' }, AuditSeverity.WARNING);
            throw error;
        }
        // Update last login
        await this.usersService.updateLastLogin(user.id);
        const sessionId = await this.sessionService.createSession(user.id, { type: 'auth-login' });
        const { accessToken, refreshToken } = await this.generateTokens(user, sessionId);
        // Save refresh token
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);
        // Log successful login
        await this.auditLogService.logAuth(AuditAction.LOGIN, user.id, user.email, ipAddress || 'unknown', userAgent || 'unknown', { sessionId });
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
  }

  /**
   * Executes logout.
   * @param userId The user identifier.
   * @param sessionId The session identifier.
   * @param ipAddress The ip address.
   * @param userAgent The user agent.
   * @returns The operation result.
   */
  async logout(
    userId: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOne(userId);

    await this.sessionService.withLock(`logout:${userId}`, async () => {
      if (sessionId) {
        await this.sessionService.removeSession(sessionId);
      }
      await this.usersService.updateRefreshToken(userId, null);
    });

    // Log logout
    await this.auditLogService.logAuth(
      AuditAction.LOGOUT,
      userId,
      user?.email || null,
      ipAddress || 'unknown',
      userAgent || 'unknown',
      { sessionId },
    );

    return { message: 'Logout successful' };
  }

  /**
   * Executes forgot Password.
   * @param email The email address.
   * @returns The operation result.
   */
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

  /**
   * Resets password.
   * @param resetPasswordDto The request payload.
   * @returns The operation result.
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    await this.passwordPolicyService.enforce(resetPasswordDto.newPassword);

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

  /**
   * Executes change Password.
   * @param userId The user identifier.
   * @param changePasswordDto The request payload.
   * @param ipAddress The ip address.
   * @param userAgent The user agent.
   * @returns The operation result.
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOne(userId);

    // Verify current password
    const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isPasswordValid) {
      await this.auditLogService.logAuth(
        AuditAction.PASSWORD_CHANGE,
        userId,
        user.email,
        ipAddress || 'unknown',
        userAgent || 'unknown',
        { success: false, reason: 'Current password incorrect' },
        AuditSeverity.WARNING,
      );
      throw new BadRequestException('Current password is incorrect');
    }

    await this.passwordPolicyService.enforce(changePasswordDto.newPassword);

    // Update password
    await this.usersService.update(userId, { password: changePasswordDto.newPassword });

    // Log password change
    await this.auditLogService.logAuth(
      AuditAction.PASSWORD_CHANGE,
      userId,
      user.email,
      ipAddress || 'unknown',
      userAgent || 'unknown',
      { success: true },
    );

    return { message: 'Password changed successfully' };
  }

  /**
   * Validates email.
   * @param token The token value.
   * @returns The operation result.
   */
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

  private async generateTokens(user: ITokenUser, sessionId: string): Promise<IAuthTokens> {
    const payload: IJwtTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    const { currentVersion, currentSecret } = this.getCurrentJwtAccessSecret();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: currentSecret,
        expiresIn: parseInt(this.configService.get<string>('JWT_EXPIRES_IN') || '900', 10), // 900s = 15m
        header: currentVersion ? { kid: currentVersion } : undefined,
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

  private getCurrentJwtAccessSecret(): { currentVersion: string | null; currentSecret: string } {
    const jwtSecretsRaw = this.configService.get<string>('JWT_SECRETS');
    const currentVersion = this.configService.get<string>('JWT_SECRET_CURRENT_VERSION') || null;

    if (!jwtSecretsRaw) {
      return {
        currentVersion,
        currentSecret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
      };
    }
    async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{
        message: string;
    }> {
        // Find user by reset token
        const userOrNull = await this.usersService.findByPasswordResetToken(resetPasswordDto.token);
        const user = ensureValidUserToken(userOrNull, 'passwordResetToken', 'passwordResetExpires', 'Invalid or expired reset token');
        // Update password
        await this.usersService.update(user.id, { password: resetPasswordDto.newPassword });
        // Clear reset token
        await this.usersService.updatePasswordResetToken(user.id, null, null);
        return { message: 'Password has been reset successfully' };
    }
    async changePassword(userId: string, changePasswordDto: ChangePasswordDto, ipAddress?: string, userAgent?: string): Promise<{
        message: string;
    }> {
        const user = await this.usersService.findOne(userId);
        // Verify current password
        const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
        if (!isPasswordValid) {
            await this.auditLogService.logAuth(AuditAction.PASSWORD_CHANGE, userId, user.email, ipAddress || 'unknown', userAgent || 'unknown', { success: false, reason: 'Current password incorrect' }, AuditSeverity.WARNING);
            throw new BadRequestException('Current password is incorrect');
        }
        // Update password
        await this.usersService.update(userId, { password: changePasswordDto.newPassword });
        // Log password change
        await this.auditLogService.logAuth(AuditAction.PASSWORD_CHANGE, userId, user.email, ipAddress || 'unknown', userAgent || 'unknown', { success: true });
        return { message: 'Password changed successfully' };
    }
    async verifyEmail(token: string): Promise<{
        message: string;
    }> {
        // Find user by verification token
        const userOrNull = await this.usersService.findByEmailVerificationToken(token);
        const user = ensureValidUserToken(userOrNull, 'emailVerificationToken', 'emailVerificationExpires', 'Invalid or expired verification token');
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
        const { currentVersion, currentSecret } = this.getCurrentJwtAccessSecret();
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: currentSecret,
                expiresIn: parseInt(this.configService.get<string>('JWT_EXPIRES_IN') || '900', 10), // 900s = 15m
                header: currentVersion ? { kid: currentVersion } : undefined,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key',
                expiresIn: parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '604800', 10), // 604800s = 7d
            }),
        ]);
        return { accessToken, refreshToken };
    }
    private getCurrentJwtAccessSecret(): {
        currentVersion: string | null;
        currentSecret: string;
    } {
        const jwtSecretsRaw = this.configService.get<string>('JWT_SECRETS');
        const currentVersion = this.configService.get<string>('JWT_SECRET_CURRENT_VERSION') || null;
        if (!jwtSecretsRaw) {
            return {
                currentVersion,
                currentSecret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
            };
        }
        const secrets = this.parseJwtSecrets(jwtSecretsRaw);
        const currentSecret = (currentVersion && secrets[currentVersion]) || this.configService.get<string>('JWT_SECRET');
        return { currentVersion, currentSecret: currentSecret || 'your-secret-key' };
    }
    private parseJwtSecrets(raw: string): Record<string, string> {
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (parsed && typeof parsed === 'object') {
                return parsed as Record<string, string>;
            }
        }
        catch {
            // ignore
        }
        return raw
            .split(',')
            .map((pair) => pair.trim())
            .filter(Boolean)
            .reduce<Record<string, string>>((acc, pair) => {
            const idx = pair.indexOf(':');
            if (idx <= 0)
                return acc;
            const version = pair.slice(0, idx).trim();
            const secret = pair.slice(idx + 1).trim();
            if (!version || !secret)
                return acc;
            acc[version] = secret;
            return acc;
        }, {});
    }
    private generateRandomToken(): string {
        return randomBytes(32).toString('hex');
    }
}
