import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RequestSigningService, SignedRequestParts } from './request-signing.service';

jest.mock('../config/cache.config', () => ({
  getSharedRedisClient: jest.fn(),
}));

const { getSharedRedisClient } = jest.requireMock('../config/cache.config');

describe('RequestSigningService', () => {
  let service: RequestSigningService;
  let redisMock: Record<string, jest.Mock>;

  const SECRET = 'test-secret-key';
  const BASE_PARTS: SignedRequestParts = {
    method: 'POST',
    path: '/api/payments',
    timestamp: Date.now().toString(),
    nonce: 'unique-nonce-123',
    body: '{"amount":1000,"currency":"USD"}',
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    redisMock = {
      set: jest.fn().mockResolvedValue('OK'),
    };
    (getSharedRedisClient as jest.Mock).mockReturnValue(redisMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestSigningService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(300_000) },
        },
      ],
    }).compile();

    service = module.get<RequestSigningService>(RequestSigningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sign', () => {
    it('produces a hex-encoded HMAC-SHA256 string', () => {
      const sig = service.sign(SECRET, 'payload');
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different signatures for different secrets', () => {
      const a = service.sign('secret-a', 'payload');
      const b = service.sign('secret-b', 'payload');
      expect(a).not.toBe(b);
    });
  });

  describe('verify', () => {
    it('returns true for a valid signature', () => {
      const sig = service.sign(SECRET, 'payload');
      expect(service.verify(SECRET, 'payload', sig)).toBe(true);
    });

    it('returns false for an invalid signature', () => {
      expect(service.verify(SECRET, 'payload', 'bad')).toBe(false);
    });

    it('uses constant-time comparison (does not throw on length mismatch)', () => {
      expect(service.verify(SECRET, 'payload', 'short')).toBe(false);
    });
  });

  describe('buildPayload', () => {
    it('builds the canonical colon-delimited string', () => {
      const result = service.buildPayload('GET', '/health', '12345', '');
      expect(result).toBe('GET:/health:12345:');
    });

    it('upper-cases the method', () => {
      const result = service.buildPayload('post', '/x', '1', '');
      expect(result).toBe('POST:/x:1:');
    });
  });

  describe('buildPayloadWithNonce', () => {
    it('includes nonce between timestamp and body', () => {
      const result = service.buildPayloadWithNonce(BASE_PARTS);
      expect(result).toBe(
        `POST:/api/payments:${BASE_PARTS.timestamp}:unique-nonce-123:{"amount":1000,"currency":"USD"}`,
      );
    });
  });

  describe('signWithNonce', () => {
    it('signs the payload built with nonce', () => {
      const sig = service.signWithNonce(SECRET, BASE_PARTS);
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifySignedRequest', () => {
    it('accepts a valid fresh request', async () => {
      const sig = service.signWithNonce(SECRET, BASE_PARTS);
      const result = await service.verifySignedRequest(SECRET, BASE_PARTS, sig);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects a request with an expired timestamp', async () => {
      const oldParts = {
        ...BASE_PARTS,
        timestamp: (Date.now() - 600_000).toString(), // 10 minutes ago
      };
      const sig = service.signWithNonce(SECRET, oldParts);
      const result = await service.verifySignedRequest(SECRET, oldParts, sig);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('timestamp_expired');
    });

    it('rejects a request with an invalid timestamp', async () => {
      const badParts = { ...BASE_PARTS, timestamp: 'not-a-number' };
      const result = await service.verifySignedRequest(SECRET, badParts, 'sig');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_timestamp');
    });

    it('rejects a replayed nonce within the freshness window', async () => {
      // First use: succeeds
      redisMock.set.mockResolvedValue('OK');
      const sig = service.signWithNonce(SECRET, BASE_PARTS);
      const first = await service.verifySignedRequest(SECRET, BASE_PARTS, sig);
      expect(first.valid).toBe(true);

      // Second use: Redis SET NX returns null
      redisMock.set.mockResolvedValue(null);
      const second = await service.verifySignedRequest(SECRET, BASE_PARTS, sig);
      expect(second.valid).toBe(false);
      expect(second.reason).toBe('nonce_reused');
    });

    it('rejects a request with a mismatched signature', async () => {
      const result = await service.verifySignedRequest(SECRET, BASE_PARTS, 'fake-signature');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('signature_mismatch');
    });

    it('stores the nonce in Redis with the correct TTL', async () => {
      const sig = service.signWithNonce(SECRET, BASE_PARTS);
      await service.verifySignedRequest(SECRET, BASE_PARTS, sig);
      expect(redisMock.set).toHaveBeenCalledWith(
        'nonce:unique-nonce-123',
        '1',
        'PX',
        service['freshnessWindowMs'],
        'NX',
      );
    });

    it('applies the configured freshness window from ConfigService', async () => {
      // Re-create with a custom window
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RequestSigningService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(60_000) },
          },
        ],
      }).compile();
      const svc = module.get<RequestSigningService>(RequestSigningService);

      // Timestamp 90 seconds ago should be rejected
      const oldParts = {
        ...BASE_PARTS,
        timestamp: (Date.now() - 90_000).toString(),
      };
      const sig = svc.signWithNonce(SECRET, oldParts);
      const result = await svc.verifySignedRequest(SECRET, oldParts, sig);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('timestamp_expired');
    });
  });
});
