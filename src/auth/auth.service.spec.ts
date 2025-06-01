import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateRefreshToken: jest.fn(),
    removeRefreshToken: jest.fn(),
    updatePassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'JWT_SECRET':
          return 'test-secret';
        case 'JWT_REFRESH_SECRET':
          return 'test-refresh-secret';
        default:
          return null;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: '1',
        ...registerDto,
        role: UserRole.STUDENT,
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUsersService.create).toHaveBeenCalled();
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: '1',
        email: loginDto.email,
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBAQNQxwQJ5K6i', // hashed 'password123'
        role: UserRole.STUDENT,
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should remove refresh token', async () => {
      await service.logout('1');
      expect(mockUsersService.removeRefreshToken).toHaveBeenCalledWith('1');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const mockUser = {
        id: '1',
        refreshToken: 'valid-refresh-token',
        role: UserRole.STUDENT,
      };

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.refreshTokens('1', 'valid-refresh-token');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('1', 'invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
