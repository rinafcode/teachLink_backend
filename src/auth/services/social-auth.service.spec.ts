import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { SocialAuthService, SocialProfile } from './social-auth.service';
import { User } from '../../users/entities/user.entity';
import {
  EncryptionService,
  IEncryptedPayload,
} from '../../security/encryption/encryption.service';

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

/**
 * Build a deterministic stub EncryptionService so we can assert on the DB
 * payload shape. We prefix every encrypted value with `enc:` followed by
 * `iv.content.tag` so the storage format is identical to the real service.
 *
 * The stub also decrypts: it reverses the serialisation to recover the
 * original token so `getDecryptedAccessToken` / `getDecryptedRefreshToken`
 * round-trip cleanly.
 */
function makeEncryptionStub() {
  const encCalls: Array<{ input: string; payload: IEncryptedPayload }> = [];

  const encryption: Partial<EncryptionService> = {
    encrypt(text: string): IEncryptedPayload {
      const payload: IEncryptedPayload = {
        iv: `iv-${Buffer.from(text).toString('hex').slice(0, 8)}`,
        content: Buffer.from(text, 'utf8').toString('hex'),
        tag: 'tag',
      };
      encCalls.push({ input: text, payload });
      return payload;
    },
    decrypt(payload: IEncryptedPayload): string {
      return Buffer.from(payload.content, 'hex').toString('utf8');
    },
  };

  return {
    encryption: encryption as EncryptionService,
    encCalls,
    serialise(payload: IEncryptedPayload): string {
      return `enc:${JSON.stringify(payload)}`;
    },
  };
}

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findOneOrFail: jest.fn(),
};

describe('SocialAuthService (Issue #799 — at-rest encryption)', () => {
  let service: SocialAuthService;
  let stub: ReturnType<typeof makeEncryptionStub>;

  beforeEach(async () => {
    stub = makeEncryptionStub();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: EncryptionService, useValue: stub.encryption },
      ],
    }).compile();

    service = module.get<SocialAuthService>(SocialAuthService);
    jest.clearAllMocks();
  });

  describe('findOrCreateFromProvider – name fallback', () => {
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
      mockRepo.findOne.mockResolvedValueOnce(null);
      mockRepo.findOne.mockResolvedValueOnce(makeUser({ provider: 'github' }));

      await expect(
        service.findOrCreateFromProvider(makeProfile({ provider: 'google' })),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Issue #799 acceptance: stored OAuth tokens are encrypted, never raw ─
  describe('provider tokens are encrypted at rest (Issue #799)', () => {
    beforeEach(() => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data) => ({ ...data }));
      mockRepo.save.mockImplementation((u) => Promise.resolve({ id: 'new-id', ...u }));
    });

    it('encrypts both access and refresh tokens when creating a new user', async () => {
      await service.findOrCreateFromProvider(
        makeProfile({ accessToken: 'AT-raw', refreshToken: 'RT-raw' }),
      );

      const created = mockRepo.create.mock.calls[0][0];
      // Stored values MUST NOT equal the raw tokens.
      expect(created.providerAccessToken).not.toBe('AT-raw');
      expect(created.providerRefreshToken).not.toBe('RT-raw');
      // Stored values MUST carry the encryption prefix.
      expect(created.providerAccessToken).toMatch(/^enc:/);
      expect(created.providerRefreshToken).toMatch(/^enc:/);
      // encrypt() was called once per token.
      expect(stub.encCalls.map((c) => c.input)).toEqual(['AT-raw', 'RT-raw']);
    });

    it('stores null when the provider did not issue a token', async () => {
      await service.findOrCreateFromProvider(
        makeProfile({ accessToken: undefined, refreshToken: undefined }),
      );
      const created = mockRepo.create.mock.calls[0][0];
      expect(created.providerAccessToken).toBeNull();
      expect(created.providerRefreshToken).toBeNull();
    });

    it('encrypts tokens when linking an existing user to a new provider', async () => {
      const user = makeUser({
        provider: null,
        providerId: null,
        providerAccessToken: null,
        providerRefreshToken: null,
      });
      mockRepo.findOneOrFail.mockResolvedValueOnce(user);

      const updated = await service.linkProvider('user-1', makeProfile({ accessToken: 'NEW-AT' }));

      expect(updated.providerAccessToken).not.toBe('NEW-AT');
      expect(updated.providerAccessToken).toMatch(/^enc:/);
    });

    it('overwrites pre-existing encrypted tokens on re-link (no plaintext regression)', async () => {
      // User has been linked before, the stored value is already encrypted.
      // We build the payload manually (NOT through stub.encryption.encrypt) so
      // `encCalls` only records whatever the service itself encrypts.
      const previousPayload: IEncryptedPayload = {
        iv: 'iv-prev',
        content: Buffer.from('OLD-AT', 'utf8').toString('hex'),
        tag: 'tag-prev',
      };
      const stored = `enc:${JSON.stringify(previousPayload)}`;
      const user = makeUser({
        provider: 'google',
        providerId: 'google-old',
        providerAccessToken: stored,
        providerRefreshToken: null,
      });
      mockRepo.findOneOrFail.mockResolvedValueOnce(user);

      // EncCalls guard: ensures the test fixture does not pollute this test's
      // assertion by sneaking in encrypt() calls during setup. (Relies on the
      // `beforeEach` block allocating a fresh stub. If someone refactors that
      // out, this assertion breaks LOUD instead of silently.)
      const encCallsBefore = [...stub.encCalls];

      await service.linkProvider('user-1', makeProfile({ accessToken: 'NEW-AT', provider: 'google' }));

      // The new value must replace the old one, AND must be encrypted.
      expect(user.providerAccessToken).not.toBe('NEW-AT');
      expect(user.providerAccessToken).not.toBe(stored);
      expect(user.providerAccessToken).toMatch(/^enc:/);
      // Only the NEW token should have hit encrypt() — never the old plaintext.
      expect(stub.encCalls.map((c) => c.input)).toEqual(
        [...encCallsBefore.map((c) => c.input), 'NEW-AT'],
      );
    });

    it('nulls out provider tokens on unlink (no encryption needed for null)', async () => {
      const user = makeUser();
      mockRepo.findOneOrFail.mockResolvedValueOnce(user);
      const updated = await service.unlinkProvider('user-1');
      expect(updated.providerAccessToken).toBeNull();
      expect(updated.providerRefreshToken).toBeNull();
    });
  });

  describe('getDecryptedAccessToken / getDecryptedRefreshToken', () => {
    it('returns the original plaintext token (round-trip)', async () => {
      const storedAT = stub.serialise(stub.encryption.encrypt('AT-plaintext'));
      const storedRT = stub.serialise(stub.encryption.encrypt('RT-plaintext'));
      // mockResolvedValue (not Once) so both calls below see the same row.
      mockRepo.findOne.mockResolvedValue(
        makeUser({ providerAccessToken: storedAT, providerRefreshToken: storedRT }),
      );

      expect(await service.getDecryptedAccessToken('user-1')).toBe('AT-plaintext');
      expect(await service.getDecryptedRefreshToken('user-1')).toBe('RT-plaintext');
    });

    it('returns null when no token is stored', async () => {
      mockRepo.findOne.mockResolvedValueOnce(makeUser({ providerAccessToken: null }));
      expect(await service.getDecryptedAccessToken('user-1')).toBeNull();
    });

    it('returns null when no user is found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      expect(await service.getDecryptedAccessToken('ghost')).toBeNull();
    });

    it('returns null (with warning) when stored value is legacy plaintext', async () => {
      const warn = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      const user = makeUser({ providerAccessToken: 'plaintext-AT' });
      mockRepo.findOne.mockResolvedValueOnce(user);

      expect(await service.getDecryptedAccessToken('user-1')).toBeNull();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('getDecryptedProviderTokens (combined decode)', () => {
    it('returns both access and refresh in a single call', async () => {
      const stored = (kind: string) =>
        stub.serialise(stub.encryption.encrypt(kind === 'at' ? 'AT-plaintext' : 'RT-plaintext'));
      mockRepo.findOne.mockResolvedValueOnce(
        makeUser({ providerAccessToken: stored('at'), providerRefreshToken: stored('rt') }),
      );

      const out = await service.getDecryptedProviderTokens('user-1');
      expect(out).toEqual({ access: 'AT-plaintext', refresh: 'RT-plaintext' });
      // Single DB call, not two.
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('returns null for either field when the column is empty', async () => {
      mockRepo.findOne.mockResolvedValueOnce(
        makeUser({ providerAccessToken: null, providerRefreshToken: null }),
      );
      const out = await service.getDecryptedProviderTokens('user-1');
      expect(out).toEqual({ access: null, refresh: null });
    });
  });
});
