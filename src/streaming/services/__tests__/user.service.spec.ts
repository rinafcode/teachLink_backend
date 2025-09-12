import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from '../user.service';
import { User, UserRole } from '../../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { jest } from '@jest/globals';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashedPassword',
    role: UserRole.STUDENT,
    avatar: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    instructedRooms: [],
    participations: [],
    messages: [],
  };

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'new@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'password123',
        role: UserRole.STUDENT,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({ ...userData, id: 'user-2' });
      mockRepository.save.mockResolvedValue({ ...userData, id: 'user-2' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      const result = await service.create(userData);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: userData.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...userData,
        password: 'hashedPassword',
      });
      expect(result.id).toBe('user-2');
    });

    it('should throw ConflictException if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'password123',
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(userData)).rejects.toThrow(ConflictException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: userData.email },
      });
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['instructedRooms', 'participations'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validatePassword', () => {
    it('should return user if password is valid', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(
        'test@example.com',
        'password123',
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedPassword',
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if password is invalid', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validatePassword(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('findInstructors', () => {
    it('should return list of active instructors', async () => {
      const instructors = [
        { ...mockUser, role: UserRole.INSTRUCTOR },
        { ...mockUser, id: 'user-2', role: UserRole.INSTRUCTOR },
      ];

      mockRepository.find.mockResolvedValue(instructors);

      const result = await service.findInstructors();

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { role: UserRole.INSTRUCTOR, isActive: true },
        select: ['id', 'email', 'firstName', 'lastName', 'avatar'],
      });
      expect(result).toEqual(instructors);
    });
  });
});
