import { Test, TestingModule } from '@nestjs/testing';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let cacheManager: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const mockCache = {
      del: jest.fn().mockResolvedValue({}),
      reset: jest.fn().mockResolvedValue({}),
      clear: jest.fn().mockResolvedValue({}),
      store: {
        keys: jest.fn().mockResolvedValue(['key1', 'key2']),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
    cacheManager = module.get(CACHE_MANAGER);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateKey', () => {
    it('should call cacheManager.del and emit event', async () => {
      await service.invalidateKey('test-key');
      expect(cacheManager.del).toHaveBeenCalledWith('test-key');
      expect(eventEmitter.emit).toHaveBeenCalledWith('cache.invalidated', { key: 'test-key', type: 'single' });
    });
  });

  describe('purgeAll', () => {
    it('should call cacheManager.clear and emit event', async () => {
      await service.purgeAll();
      expect(cacheManager.clear).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('cache.purged', expect.any(Object));
    });
  });
});
