jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { User, UserStatus } from '../users/entities/user.entity';

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
};

const mockBlacklistService = {
  addToBlacklist: jest.fn(),
  isBlacklisted: jest.fn(),
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
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockBlacklistService.isBlacklisted.mockResolvedValue(true);
      mockUserRepo.update.mockResolvedValue(undefined);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(UnauthorizedException);
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { refreshToken: null });
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

    it('issues new tokens when the refresh token is valid and not blacklisted', async () => {
      mockJwtService.verify.mockReturnValue(validDecoded);
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockBlacklistService.isBlacklisted.mockResolvedValue(false);
      mockBlacklistService.addToBlacklist.mockResolvedValue(undefined);
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      mockUserRepo.update.mockResolvedValue(undefined);

      const result = await service.refreshTokens('valid-token');

      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    });
  });
});
