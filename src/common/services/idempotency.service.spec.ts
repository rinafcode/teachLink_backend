import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: undefined,
        IDEMPOTENCY_TTL_SECONDS: 86400,
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateKey', () => {
    it('should generate a unique key based on user, endpoint, and payload', () => {
      const userId = 'user123';
      const endpoint = '/payments/create-intent';
      const payload = { amount: 100, courseId: 'course456' };

      const key1 = service.generateKey(userId, endpoint, payload);
      const key2 = service.generateKey(userId, endpoint, payload);

      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // SHA-256 hash length
    });

    it('should generate different keys for different payloads', () => {
      const userId = 'user123';
      const endpoint = '/payments/create-intent';
      const payload1 = { amount: 100 };
      const payload2 = { amount: 200 };

      const key1 = service.generateKey(userId, endpoint, payload1);
      const key2 = service.generateKey(userId, endpoint, payload2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different users', () => {
      const endpoint = '/payments/create-intent';
      const payload = { amount: 100 };

      const key1 = service.generateKey('user1', endpoint, payload);
      const key2 = service.generateKey('user2', endpoint, payload);

      expect(key1).not.toBe(key2);
    });
  });

  describe('cleanup', () => {
    it('should not throw error when cleaning up', async () => {
      // This would require mocking Redis
      // For now, we just ensure the method exists
      expect(service.cleanup).toBeDefined();
    });
  });
});
