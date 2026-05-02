import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session/session.service';
import { TransactionService } from '../common/database/transaction.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UserRole } from '../users/entities/user.entity';
import { AuditAction, AuditSeverity } from '../audit-log/enums/audit-action.enum';
import {
  createMockRepository,
  createMockConfigService,
  createMockEventEmitter,
} from '../../test/utils/mock-factories';
import { Repository } from 'typeorm';
describe('AuthService', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // DECLARATIONS
  // ─────────────────────────────────────────────────────────────────────────

  let service: AuthService;
  let mockUsersService: jest.Mocked<UsersService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockTransactionService: jest.Mocked<any>;
  let mockNotificationsService: jest.Mocked<NotificationsService>;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP & TEARDOWN
  // ─────────────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    // Initialize all dependency mocks
    mockUsersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findOne: jest.fn(),
      updateEmailVerificationToken: jest.fn(),
      updateRefreshToken: jest.fn(),
      updateLastLogin: jest.fn(),
      updatePasswordResetToken: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    mockConfigService = createMockConfigService({
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    });

    mockSessionService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      removeSession: jest.fn(),
      touchSession: jest.fn(),
      withLock: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    mockTransactionService = {
      runInTransaction: jest.fn(),
    } as jest.Mocked<any>;

    mockNotificationsService = {
      sendVerificationEmail: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;

    mockAuditLogService = {
      logAuth: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST SUITES
  // ─────────────────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockUser = {
      id: 'user-1',
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: UserRole.STUDENT,
      isEmailVerified: false,
    };

    beforeEach(() => {
      mockTransactionService.runInTransaction.mockImplementation(async (fn) => fn());
      mockUsersService.create.mockResolvedValue(mockUser as any);
      mockUsersService.updateEmailVerificationToken.mockResolvedValue(undefined);
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);
      mockSessionService.createSession.mockResolvedValue('session-1');
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockNotificationsService.sendVerificationEmail.mockResolvedValue(undefined);
      mockAuditLogService.logAuth.mockResolvedValue(undefined);
    });
    // ─────────────────────────────────────────────────────────────────────────
    // TEST SUITES
    // ─────────────────────────────────────────────────────────────────────────
    describe('register', () => {
        const registerDto = {
            email: 'test@example.com',
            password: 'Password123!',
            firstName: 'John',
            lastName: 'Doe',
        };
        const mockUser = {
            id: 'user-1',
            email: registerDto.email,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            role: UserRole.STUDENT,
            isEmailVerified: false,
        };
        beforeEach(() => {
            mockTransactionService.runInTransaction.mockImplementation(async (fn) => fn());
            mockUsersService.create.mockResolvedValue(mockUser);
            mockUsersService.updateEmailVerificationToken.mockResolvedValue(undefined);
            mockUsersService.updateRefreshToken.mockResolvedValue(undefined);
            mockSessionService.createSession.mockResolvedValue('session-1');
            mockJwtService.sign
                .mockReturnValueOnce('access-token')
                .mockReturnValueOnce('refresh-token');
            mockNotificationsService.sendVerificationEmail.mockResolvedValue(undefined);
            mockAuditLogService.logAuth.mockResolvedValue(undefined);
        });
        it('should register a new user successfully', async () => {
            const result = await service.register(registerDto, '127.0.0.1', 'TestAgent');
            expect(result).toEqual({
                user: {
                    id: mockUser.id,
                    email: mockUser.email,
                    firstName: mockUser.firstName,
                    lastName: mockUser.lastName,
                    role: mockUser.role,
                    isEmailVerified: mockUser.isEmailVerified,
                },
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                message: 'Registration successful. Please check your email to verify your account.',
            });
            expect(mockUsersService.create).toHaveBeenCalledWith(registerDto);
            expect(mockNotificationsService.sendVerificationEmail).toHaveBeenCalled();
            expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(AuditAction.REGISTER, mockUser.id, mockUser.email, '127.0.0.1', 'TestAgent', { sessionId: 'session-1' });
        });
        it('should handle registration without IP and user agent', async () => {
            await service.register(registerDto);
            expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(AuditAction.REGISTER, mockUser.id, mockUser.email, 'unknown', 'unknown', { sessionId: 'session-1' });
        });
        it('should run registration in a transaction', async () => {
            await service.register(registerDto);
            expect(mockTransactionService.runInTransaction).toHaveBeenCalled();
        });
    });
    describe('login', () => {
        const loginDto = {
            email: 'test@example.com',
            password: 'Password123!',
        };
        const mockUser = {
            id: 'user-1',
            email: loginDto.email,
            password: '$2a$10$hashedpassword',
            firstName: 'John',
            lastName: 'Doe',
            role: UserRole.STUDENT,
            isEmailVerified: true,
            status: 'ACTIVE',
        };
        beforeEach(() => {
            mockUsersService.findByEmail.mockResolvedValue(mockUser);
            mockUsersService.updateLastLogin.mockResolvedValue(undefined);
            mockUsersService.updateRefreshToken.mockResolvedValue(undefined);
            mockSessionService.createSession.mockResolvedValue('session-1');
            mockJwtService.sign
                .mockReturnValueOnce('access-token')
                .mockReturnValueOnce('refresh-token');
            mockAuditLogService.logAuth.mockResolvedValue(undefined);
        });
        it('should login user successfully with valid credentials', async () => {
            // Mock bcrypt.compare to return true
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            const result = await service.login(loginDto, '127.0.0.1', 'TestAgent');
            expect(result).toEqual({
                user: {
                    id: mockUser.id,
                    email: mockUser.email,
                    firstName: mockUser.firstName,
                    lastName: mockUser.lastName,
                    role: mockUser.role,
                    isEmailVerified: mockUser.isEmailVerified,
                },
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
            expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
            expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
            expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(AuditAction.LOGIN, mockUser.id, mockUser.email, '127.0.0.1', 'TestAgent', { sessionId: 'session-1' });
        });
        it('should throw UnauthorizedException when user not found', async () => {
            mockUsersService.findByEmail.mockResolvedValue(null);
            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
            expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(AuditAction.LOGIN_FAILED, null, loginDto.email, 'unknown', 'unknown', { reason: 'User not found' }, AuditSeverity.WARNING);
        });
        it('should throw UnauthorizedException when password is invalid', async () => {
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
            expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(AuditAction.LOGIN_FAILED, mockUser.id, mockUser.email, 'unknown', 'unknown', { reason: 'Invalid password' }, AuditSeverity.WARNING);
        });
        it('should handle login without IP and user agent', async () => {
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            await service.login(loginDto);
            expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(AuditAction.LOGIN, mockUser.id, mockUser.email, 'unknown', 'unknown', { sessionId: 'session-1' });
        });
    });
    describe('refreshToken', () => {
        const refreshToken = 'valid-refresh-token';
        const mockUser = {
            id: 'user-1',
            email: 'test@example.com',
            refreshToken: '$2a$10$hashedrefreshtoken',
        };
        beforeEach(() => {
            mockJwtService.verify.mockReturnValue({
                sub: mockUser.id,
                email: mockUser.email,
                sid: 'session-1',
            });
            mockSessionService.withLock.mockImplementation(async (key, fn) => fn());
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockSessionService.getSession.mockResolvedValue({ id: 'session-1' });
            mockSessionService.touchSession.mockResolvedValue(undefined);
            mockJwtService.sign
                .mockReturnValueOnce('new-access-token')
                .mockReturnValueOnce('new-refresh-token');
            mockUsersService.updateRefreshToken.mockResolvedValue(undefined);
        });
        it('should refresh tokens successfully', async () => {
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            const result = await service.refreshToken(refreshToken);
            expect(result).toEqual({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });
            expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, {
                secret: 'refresh-secret',
            });
            expect(mockSessionService.touchSession).toHaveBeenCalledWith('session-1', {
                lastRefreshAt: expect.any(Number),
            });
        });
        it('should create new session if current session not found', async () => {
            mockSessionService.getSession.mockResolvedValue(null);
            mockSessionService.createSession.mockResolvedValue('new-session-1');
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            await service.refreshToken(refreshToken);
            expect(mockSessionService.createSession).toHaveBeenCalledWith(mockUser.id, {
                type: 'auth-refresh',
            });
        });
        it('should throw UnauthorizedException when refresh token is invalid', async () => {
            mockJwtService.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
        });
        it('should throw UnauthorizedException when user not found', async () => {
            mockUsersService.findOne.mockResolvedValue(null);
            await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
        });
        it('should throw UnauthorizedException when stored refresh token is invalid', async () => {
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
            await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
        });
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const mockUser = {
      id: 'user-1',
      email: loginDto.email,
      password: '$2a$10$hashedpassword',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.STUDENT,
      isEmailVerified: true,
      status: 'ACTIVE',
    };

    beforeEach(() => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser as any);
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);
      mockSessionService.createSession.mockResolvedValue('session-1');
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockAuditLogService.logAuth.mockResolvedValue(undefined);
    });

    it('should login user successfully with valid credentials', async () => {
      // Mock bcrypt.compare to return true
      (
        jest.spyOn(bcrypt, 'compare') as unknown as jest.SpyInstance<
          Promise<boolean>,
          [string, string]
        >
      ).mockResolvedValue(true);

      const result = await service.login(loginDto, '127.0.0.1', 'TestAgent');

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role,
          isEmailVerified: mockUser.isEmailVerified,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
      expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(
        AuditAction.LOGIN,
        mockUser.id,
        mockUser.email,
        '127.0.0.1',
        'TestAgent',
        { sessionId: 'session-1' },
      );
    });
    describe('generateTokens', () => {
        const mockUser = {
            id: 'user-1',
            email: 'test@example.com',
            role: UserRole.STUDENT,
        };
        const sessionId = 'session-1';
        beforeEach(() => {
            mockJwtService.sign
                .mockReturnValueOnce('access-token')
                .mockReturnValueOnce('refresh-token');
        });
        it('should generate access and refresh tokens', async () => {
            const result = await (service as unknown).generateTokens(mockUser, sessionId);
            expect(result).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
            expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
            expect(mockJwtService.sign).toHaveBeenNthCalledWith(1, {
                sub: mockUser.id,
                email: mockUser.email,
                role: mockUser.role,
                sid: sessionId,
            }, {
                secret: 'access-secret',
                expiresIn: '15m',
            });
        });
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      (
        jest.spyOn(bcrypt, 'compare') as unknown as jest.SpyInstance<
          Promise<boolean>,
          [string, string]
        >
      ).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(
        AuditAction.LOGIN_FAILED,
        mockUser.id,
        mockUser.email,
        'unknown',
        'unknown',
        { reason: 'Invalid password' },
        AuditSeverity.WARNING,
      );
    });

    it('should handle login without IP and user agent', async () => {
      (
        jest.spyOn(bcrypt, 'compare') as unknown as jest.SpyInstance<
          Promise<boolean>,
          [string, string]
        >
      ).mockResolvedValue(true);

      await service.login(loginDto);

      expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(
        AuditAction.LOGIN,
        mockUser.id,
        mockUser.email,
        'unknown',
        'unknown',
        { sessionId: 'session-1' },
      );
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      refreshToken: '$2a$10$hashedrefreshtoken',
    };

    beforeEach(() => {
      mockJwtService.verify.mockReturnValue({
        sub: mockUser.id,
        email: mockUser.email,
        sid: 'session-1',
      });
      mockSessionService.withLock.mockImplementation(async (key, fn) => fn());
      mockUsersService.findOne.mockResolvedValue(mockUser as any);
      mockSessionService.getSession.mockResolvedValue({ id: 'session-1' } as any);
      mockSessionService.touchSession.mockResolvedValue(undefined);
      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);
    });

    it('should refresh tokens successfully', async () => {
      (
        jest.spyOn(bcrypt, 'compare') as unknown as jest.SpyInstance<
          Promise<boolean>,
          [string, string]
        >
      ).mockResolvedValue(true);

      const result = await service.refreshToken(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'refresh-secret',
      });
      expect(mockSessionService.touchSession).toHaveBeenCalledWith('session-1', {
        lastRefreshAt: expect.any(Number),
      });
    });

    it('should create new session if current session not found', async () => {
      mockSessionService.getSession.mockResolvedValue(null);
      mockSessionService.createSession.mockResolvedValue('new-session-1');

      (
        jest.spyOn(bcrypt, 'compare') as unknown as jest.SpyInstance<
          Promise<boolean>,
          [string, string]
        >
      ).mockResolvedValue(true);

      await service.refreshToken(refreshToken);

      expect(mockSessionService.createSession).toHaveBeenCalledWith(mockUser.id, {
        type: 'auth-refresh',
      });
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser as any);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when stored refresh token is invalid', async () => {
      (
        jest.spyOn(bcrypt, 'compare') as unknown as jest.SpyInstance<
          Promise<boolean>,
          [string, string]
        >
      ).mockResolvedValue(false);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    const userId = 'user-1';
    const sessionId = 'session-1';
    const mockUser = {
      id: userId,
      email: 'test@example.com',
    };

    beforeEach(() => {
      mockUsersService.findOne.mockResolvedValue(mockUser as any);
      mockSessionService.withLock.mockImplementation(async (key, fn) => fn());
      mockSessionService.removeSession.mockResolvedValue(undefined);
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);
      mockAuditLogService.logAuth.mockResolvedValue(undefined);
    });

    it('should logout user successfully', async () => {
      const result = await service.logout(userId, sessionId, '127.0.0.1', 'TestAgent');

      expect(result).toEqual({ message: 'Logout successful' });
      expect(mockSessionService.removeSession).toHaveBeenCalledWith(sessionId);
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(userId, null);
      expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(
        AuditAction.LOGOUT,
        userId,
        mockUser.email,
        '127.0.0.1',
        'TestAgent',
        { sessionId },
      );
    });

    it('should handle logout without session ID', async () => {
      await service.logout(userId);

      expect(mockSessionService.removeSession).not.toHaveBeenCalled();
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(userId, null);
    });

    it('should handle logout without IP and user agent', async () => {
      await service.logout(userId, sessionId);

      expect(mockAuditLogService.logAuth).toHaveBeenCalledWith(
        AuditAction.LOGOUT,
        userId,
        mockUser.email,
        'unknown',
        'unknown',
        { sessionId },
      );
    });
  });

  describe('forgotPassword', () => {
    const email = 'test@example.com';
    const mockUser = { id: 'user-1', email };

    beforeEach(() => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser as any);
      mockUsersService.updatePasswordResetToken.mockResolvedValue(undefined);
    });

    it('should initiate password reset for existing user', async () => {
      const result = await service.forgotPassword(email);

      expect(result).toEqual({
        message: 'If the email exists, a password reset link has been sent.',
      });
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email);
      expect(mockUsersService.updatePasswordResetToken).toHaveBeenCalled();
    });

    it('should not reveal if user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result).toEqual({
        message: 'If the email exists, a password reset link has been sent.',
      });
      expect(mockUsersService.updatePasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('generateTokens', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: UserRole.STUDENT,
    };
    const sessionId = 'session-1';

    beforeEach(() => {
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
    });

    it('should generate access and refresh tokens', async () => {
      const result = await (service as any).generateTokens(mockUser, sessionId);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        {
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          sid: sessionId,
        },
        {
          secret: 'access-secret',
          expiresIn: '15m',
        },
      );
    });
  });

  describe('generateRandomToken', () => {
    it('should generate a random token', () => {
      const token1 = (service as any).generateRandomToken();
      const token2 = (service as any).generateRandomToken();

      expect(typeof token1).toBe('string');
      expect(token1.length).toBeGreaterThan(0);
      expect(token1).not.toBe(token2); // Should be different each time
    });
  });
});
