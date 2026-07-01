import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import {
  AuthTokensService,
  hashToken,
} from './auth-tokens.service';

function makeMockRepo() {
  return {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn(),
  };
}

describe('AuthTokensService (Issue #801 — SHA-256 hashed tokens)', () => {
  let service: AuthTokensService;
  let mockRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    mockRepo = makeMockRepo();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthTokensService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();
    service = moduleRef.get(AuthTokensService);
  });

  describe('hashToken (helper)', () => {
    it('produces a 64-character hex SHA-256 digest', () => {
      const h = hashToken('hello-world');
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for the same input', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'));
    });

    it('differs for different inputs', () => {
      expect(hashToken('abc')).not.toBe(hashToken('abd'));
    });
  });

  describe('generateTokenPair', () => {
    it('returns a 64-char hex raw token (32 bytes) and matching hash', () => {
      const pair = service.generateTokenPair();
      expect(pair.rawToken).toHaveLength(64);
      expect(pair.rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(pair.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(pair.tokenHash).toBe(hashToken(pair.rawToken));
    });

    it('returns an expiry ~24 hours in the future', () => {
      const before = Date.now();
      const pair = service.generateTokenPair();
      const gap = pair.expiresAt.getTime() - before;
      expect(gap).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(gap).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 10);
    });

    it('produces unique tokens across calls', () => {
      const a = service.generateTokenPair();
      const b = service.generateTokenPair();
      expect(a.rawToken).not.toBe(b.rawToken);
    });
  });

  describe('issuePasswordReset', () => {
    it('persists the SHA-256 hash, not the raw token', async () => {
      const { rawToken } = await service.issuePasswordReset('user-1');
      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
      const [criteria, update] = mockRepo.update.mock.calls[0];
      expect(criteria).toEqual({ id: 'user-1' });
      // Persisted value MUST be the hash, never the raw.
      expect(update.passwordResetToken).toBe(hashToken(rawToken));
      expect(update.passwordResetToken).not.toBe(rawToken);
      expect(update.passwordResetExpires).toBeInstanceOf(Date);
    });
  });

  describe('issueEmailVerification', () => {
    it('persists the SHA-256 hash, not the raw token', async () => {
      const { rawToken } = await service.issueEmailVerification('user-2');
      const [criteria, update] = mockRepo.update.mock.calls[0];
      expect(criteria).toEqual({ id: 'user-2' });
      expect(update.emailVerificationToken).toBe(hashToken(rawToken));
      expect(update.emailVerificationToken).not.toBe(rawToken);
      expect(update.emailVerificationExpires).toBeInstanceOf(Date);
    });
  });

  describe('consumePasswordReset', () => {
    it('returns the matching user and clears the stored hash', async () => {
      const raw = 'a'.repeat(64);
      const expectedHash = hashToken(raw);
      const user = { id: 'user-7' } as User;
      mockRepo.findOne.mockResolvedValueOnce(user);

      const result = await service.consumePasswordReset(raw);
      expect(result).toBe(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            passwordResetToken: expectedHash,
            passwordResetExpires: expect.anything(),
          }),
        }),
      );
      const [criteria, update] = mockRepo.update.mock.calls[0];
      expect(criteria).toEqual({ id: 'user-7' });
      expect(update.passwordResetToken).toBeNull();
      expect(update.passwordResetExpires).toBeNull();
    });

    it('returns null when no user matches', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      expect(await service.consumePasswordReset('bad-token')).toBeNull();
    });

    it('returns null for empty input', async () => {
      expect(await service.consumePasswordReset('')).toBeNull();
    });
  });

  describe('consumeEmailVerification', () => {
    it('returns the matching user, sets isEmailVerified, and clears the hash', async () => {
      const raw = 'b'.repeat(64);
      const user = { id: 'user-8' } as User;
      mockRepo.findOne.mockResolvedValueOnce(user);

      const result = await service.consumeEmailVerification(raw);
      expect(result).toBe(user);
      const [, update] = mockRepo.update.mock.calls[0];
      expect(update.isEmailVerified).toBe(true);
      expect(update.emailVerificationToken).toBeNull();
    });
  });

  describe('verifyTokenHash', () => {
    it('returns true for matching inputs', () => {
      const raw = 'tok';
      const stored = hashToken(raw);
      expect(service.verifyTokenHash(raw, stored)).toBe(true);
    });

    it('returns false for mismatched inputs', () => {
      const stored = hashToken('correct');
      expect(service.verifyTokenHash('wrong', stored)).toBe(false);
    });

    it('returns false when stored hash is missing', () => {
      expect(service.verifyTokenHash('x', null)).toBe(false);
      expect(service.verifyTokenHash('x', undefined)).toBe(false);
      expect(service.verifyTokenHash('x', '')).toBe(false);
    });

    it('returns false when raw token is empty', () => {
      expect(service.verifyTokenHash('', hashToken('x'))).toBe(false);
    });
  });

  describe('regression: raw token never reaches the database column', () => {
    it('does not write raw token into passwordResetToken column', async () => {
      const { rawToken } = await service.issuePasswordReset('user-9');
      const [, update] = mockRepo.update.mock.calls[0];
      expect(update.passwordResetToken).not.toBe(rawToken);
      expect(update.passwordResetToken).toBe(hashToken(rawToken));
    });

    it('does not write raw token into emailVerificationToken column', async () => {
      const { rawToken } = await service.issueEmailVerification('user-10');
      const [, update] = mockRepo.update.mock.calls[0];
      expect(update.emailVerificationToken).not.toBe(rawToken);
      expect(update.emailVerificationToken).toBe(hashToken(rawToken));
    });
  });
});
