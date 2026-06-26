import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { SocialAuthService, SocialProfile } from './social-auth.service';
import { User } from '../../users/entities/user.entity';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'existing@example.com',
    firstName: 'Old',
    lastName: 'Name',
    provider: 'google',
    providerId: 'google-123',
    providerAccessToken: null,
    providerRefreshToken: null,
    profilePicture: null,
    isEmailVerified: true,
    ...overrides,
  } as User;
}

function makeProfile(overrides: Partial<SocialProfile> = {}): SocialProfile {
  return {
    provider: 'google',
    providerId: 'google-999',
    email: 'new@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    ...overrides,
  };
}

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findOneOrFail: jest.fn(),
};

describe('SocialAuthService – name fallback', () => {
  let service: SocialAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SocialAuthService>(SocialAuthService);
    jest.clearAllMocks();
  });

  describe('findOrCreateFromProvider – new user creation', () => {
    beforeEach(() => {
      // No existing user by provider or email
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data) => ({ ...data }));
      mockRepo.save.mockImplementation((u) => Promise.resolve({ id: 'new-id', ...u }));
    });

    it('uses provider firstName/lastName when present', async () => {
      await service.findOrCreateFromProvider(makeProfile({ firstName: 'Jane', lastName: 'Doe' }));

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }),
      );
    });

    it('falls back to email local-part as firstName when provider omits names', async () => {
      await service.findOrCreateFromProvider(
        makeProfile({ firstName: undefined, lastName: undefined, email: 'jdoe@example.com' }),
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'jdoe', lastName: '' }),
      );
    });

    it('falls back to providerId as firstName when both name and email are absent', async () => {
      await service.findOrCreateFromProvider(
        makeProfile({ firstName: undefined, lastName: undefined, email: undefined }),
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'google-999' }),
      );
    });

    it('trims whitespace-only firstName and falls back', async () => {
      await service.findOrCreateFromProvider(
        makeProfile({ firstName: '   ', lastName: '   ', email: 'trimmed@example.com' }),
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'trimmed', lastName: '' }),
      );
    });

    it('does not produce empty-string firstName', async () => {
      await service.findOrCreateFromProvider(
        makeProfile({ firstName: '', lastName: '', email: 'user@example.com' }),
      );

      const created = mockRepo.create.mock.calls[0][0];
      expect(created.firstName).not.toBe('');
    });
  });

  describe('findOrCreateFromProvider – existing provider account', () => {
    it('returns existing user without creating a new one', async () => {
      const existing = makeUser();
      mockRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.findOrCreateFromProvider(makeProfile());

      expect(result).toBe(existing);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreateFromProvider – email conflict', () => {
    it('throws ConflictException when email is registered under a different provider', async () => {
      // No provider match
      mockRepo.findOne.mockResolvedValueOnce(null);
      // Email match with different provider
      mockRepo.findOne.mockResolvedValueOnce(makeUser({ provider: 'github' }));

      await expect(
        service.findOrCreateFromProvider(makeProfile({ provider: 'google' })),
      ).rejects.toThrow(ConflictException);
    });
  });
});
