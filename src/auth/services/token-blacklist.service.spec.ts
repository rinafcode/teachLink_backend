import { Test, TestingModule } from '@nestjs/testing';
import { TokenBlacklistService } from './token-blacklist.service';
import { CachingService } from '../../caching/caching.service';

const mockCachingService = {
  set: jest.fn(),
  get: jest.fn(),
};

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        { provide: CachingService, useValue: mockCachingService },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addToBlacklist', () => {
    it('stores the token JTI in cache with TTL converted to seconds', async () => {
      mockCachingService.set.mockResolvedValue(undefined);

      await service.addToBlacklist('jti-1', 60_000);

      expect(mockCachingService.set).toHaveBeenCalledWith('bl_token:jti-1', 'revoked', 60);
    });

    it('rounds fractional TTL up to the nearest whole second', async () => {
      mockCachingService.set.mockResolvedValue(undefined);

      await service.addToBlacklist('jti-2', 1_500);

      expect(mockCachingService.set).toHaveBeenCalledWith('bl_token:jti-2', 'revoked', 2);
    });

    it('stores the correct cache key prefix', async () => {
      mockCachingService.set.mockResolvedValue(undefined);

      await service.addToBlacklist('my-jti', 10_000);

      expect(mockCachingService.set).toHaveBeenCalledWith(
        expect.stringContaining('bl_token:my-jti'),
        'revoked',
        expect.any(Number),
      );
    });
  });

  describe('isBlacklisted', () => {
    it('returns true when the cache entry equals "revoked"', async () => {
      mockCachingService.get.mockResolvedValue('revoked');

      const result = await service.isBlacklisted('jti-3');

      expect(result).toBe(true);
      expect(mockCachingService.get).toHaveBeenCalledWith('bl_token:jti-3');
    });

    it('returns false when the cache entry does not exist', async () => {
      mockCachingService.get.mockResolvedValue(null);

      const result = await service.isBlacklisted('jti-4');

      expect(result).toBe(false);
    });

    it('returns false when the cache entry has an unexpected value', async () => {
      mockCachingService.get.mockResolvedValue('expired');

      const result = await service.isBlacklisted('jti-5');

      expect(result).toBe(false);
    });
  });
});
