import 'reflect-metadata';
import { createHmac } from 'crypto';

jest.mock('../users/entities/user.entity', () => ({
  User: class User {},
  UserStatus: {
    ACTIVE: 'active',
  },
}));

jest.mock('../security/audit/security-event-logger', () => ({
  SecurityEventLogger: class SecurityEventLogger {},
  SecurityEventType: {
    AUTH_FAILURE: 'AUTH_FAILURE',
    TOKEN_REUSE: 'TOKEN_REUSE',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { User, UserStatus } from '../users/entities/user.entity';
import { SecurityEventLogger, SecurityEventType } from '../security/audit/security-event-logger';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashed',
    firstName: 'Test',
    lastName: 'User',
    status: UserStatus.ACTIVE,
    refreshToken: 'old-hash',
    passwordHistory: [],
    roles: [{ name: 'student' }],
    ...overrides,
  } as User;
}

const mockUserRepo = {
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
};

const mockBlacklistService = {
  addToBlacklist: jest.fn(),
  isBlacklisted: jest.fn(),
};

const mockSecurityEventLogger = {
  emit: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
    if (key === 'BCRYPT_ROUNDS') return 10;
    return defaultValue;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: TokenBlacklistService, useValue: mockBlacklistService },
        { provide: SecurityEventLogger, useValue: mockSecurityEventLogger },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('generates tokens and stores hashed refresh token', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockUserRepo.update.mockResolvedValue(undefined);

      const result = await service.login(makeUser());

      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ refreshToken: expect.any(String) }),
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token for the given user', async () => {
      mockUserRepo.update.mockResolvedValue(undefined);

      await service.logout('user-1');

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { refreshToken: null });
    });

    it('blacklists the access token JTI when a valid access token is provided', async () => {
      const jti = 'access-jti-xyz';
      const exp = Math.floor(Date.now() / 1000) + 900; // 15 min from now
      mockJwtService.decode = jest.fn().mockReturnValue({ jti, exp });
      mockBlacklistService.addToBlacklist.mockResolvedValue(undefined);
      mockUserRepo.update.mockResolvedValue(undefined);

      await service.logout('user-1', 'fake.access.token');

      expect(mockBlacklistService.addToBlacklist).toHaveBeenCalledWith(jti, expect.any(Number));
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { refreshToken: null });
    });

    it('still revokes refresh token when access token has no jti', async () => {
      mockJwtService.decode = jest.fn().mockReturnValue({ sub: 'user-1' });
      mockUserRepo.update.mockResolvedValue(undefined);

      await service.logout('user-1', 'token.without.jti');

      expect(mockBlacklistService.addToBlacklist).not.toHaveBeenCalled();
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { refreshToken: null });
    });
  });

  describe('refreshTokens', () => {
    const validDecoded = {
      sub: 'user-1',
      email: 'test@example.com',
      jti: 'jti-abc',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('throws UnauthorizedException when the token cannot be verified', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
      expect(mockSecurityEventLogger.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.AUTH_FAILURE,
          severity: 'medium',
          details: expect.objectContaining({ reason: 'invalid_or_expired_refresh_token' }),
        }),
      );
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has no stored refresh token', async () => {
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(makeUser({ refreshToken: undefined }));

      await expect(service.refreshTokens('token')).rejects.toThrow(UnauthorizedException);
    });

    it('revokes all tokens and throws when a blacklisted token is reused', async () => {
      const rawToken = 'revoked-token';
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(makeUser({ refreshToken: hmacToken(rawToken) }));
      mockBlacklistService.isBlacklisted.mockResolvedValue(true);
      mockUserRepo.update.mockResolvedValue(undefined);

      await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { refreshToken: null });
      expect(mockSecurityEventLogger.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.TOKEN_REUSE,
          userId: 'user-1',
          severity: 'critical',
          details: expect.objectContaining({ jti: 'jti-abc' }),
        }),
      );
    });

    it('throws UnauthorizedException when the user status is SUSPENDED', async () => {
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(makeUser({ status: UserStatus.SUSPENDED }));

      await expect(service.refreshTokens('token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user status is INACTIVE', async () => {
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(makeUser({ status: UserStatus.INACTIVE }));

      await expect(service.refreshTokens('token')).rejects.toThrow(UnauthorizedException);
    });

    function hmacToken(token: string): string {
      const secret =
        process.env.HMAC_SECRET || process.env.JWT_REFRESH_SECRET || 'default-hmac-secret';
      return createHmac('sha256', secret).update(token).digest('hex');
    }

    it('issues new tokens when the refresh token is valid and not blacklisted', async () => {
      const rawToken = 'valid-token';
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(makeUser({ refreshToken: hmacToken(rawToken) }));
      mockBlacklistService.isBlacklisted.mockResolvedValue(false);
      mockBlacklistService.addToBlacklist.mockResolvedValue(undefined);
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      mockUserRepo.update.mockResolvedValue(undefined);

      const result = await service.refreshTokens(rawToken);

      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    });

    it('throws UnauthorizedException when the refresh token hash does not match', async () => {
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(
        makeUser({ refreshToken: hmacToken('some-other-token') }),
      );

      await expect(service.refreshTokens('wrong-token')).rejects.toThrow(UnauthorizedException);
      expect(mockSecurityEventLogger.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEventType.AUTH_FAILURE,
          severity: 'high',
          details: expect.objectContaining({ reason: 'refresh_token_hash_mismatch' }),
        }),
      );
    });
  });
});
