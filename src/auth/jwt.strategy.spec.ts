import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { User, UserStatus } from '../users/entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockUserRepo = {
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: getRepositoryToken(User), useValue: mockUserRepo }],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'test@example.com',
      roles: [],
      permissions: [],
    };

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      status: UserStatus.ACTIVE,
    };

    const mockUserWithRolesAndPermissions = {
      ...mockUser,
      roles: [
        {
          name: 'student',
          permissions: [{ resource: 'course', action: 'read' }],
        },
      ],
    };

    it('should successfully validate and return payload with roles and permissions if user is active', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(mockUser);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUserWithRolesAndPermissions),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await strategy.validate(payload);

      expect(mockUserRepo.findOneBy).toHaveBeenCalledWith({ id: 'user-1' });
      expect(result).toEqual({
        sub: 'user-1',
        email: 'test@example.com',
        roles: ['student'],
        permissions: ['course:read'],
      });
    });

    it('should throw UnauthorizedException if the user is suspended', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if the user is inactive', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({
        ...mockUser,
        status: UserStatus.INACTIVE,
      });

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an error if the user is not found', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(Error);
    });
  });
});
